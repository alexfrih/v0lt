declare global {
  interface Window {
    electronAPI: {
      connectS3: (credentials: any) => Promise<any>;
      getCredentials: () => Promise<any>;
      clearCredentials: () => Promise<any>;
      listObjects: (params: any) => Promise<any>;
      uploadFile: (params: any) => Promise<any>;
      uploadFileWithProgress: (params: any) => Promise<any>;
      downloadFile: (params: any) => Promise<any>;
      downloadFileWithProgress: (params: any) => Promise<any>;
      downloadFiles: (params: any) => Promise<any>;
      deleteFile: (params: any) => Promise<any>;
      createFolder: (params: any) => Promise<any>;
      deleteFolder: (params: any) => Promise<any>;
      downloadFolder: (params: any) => Promise<any>;
      renameFile: (params: any) => Promise<any>;
      renameFolder: (params: any) => Promise<any>;
      openFileDialog: () => Promise<string[] | null>;
      openUrl: (url: string) => Promise<void>;
      onTransferProgress: (callback: (event: any, data: any) => void) => void;
    }
  }
}

export interface S3Config {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  bucket_name: string;
  endpoint_url?: string;
}

export interface S3File {
  key: string;
  size: number;
  last_modified: string;
  storage_class?: string;
}

export interface S3Folder {
  prefix: string;
}

export interface StoredCredentials {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  bucket_name: string;
  endpoint_url?: string;
}

// Store current bucket and path in memory
let currentBucket: string | null = null;
let currentPath: string = '';

export const api = {
  getCurrentPath: () => currentPath,
  
  setCurrentPath: (path: string) => {
    currentPath = path;
  },
  async connect(config: S3Config): Promise<void> {
    const result = await window.electronAPI.connectS3({
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
      region: config.region,
      bucket: config.bucket_name,
      endpoint: config.endpoint_url
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to connect to S3');
    }
    
    currentBucket = config.bucket_name;
  },

  async listFiles(prefix?: string): Promise<{ files: S3File[]; folders: S3Folder[] }> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const actualPrefix = prefix !== undefined ? prefix : currentPath;
    const result = await window.electronAPI.listObjects({
      bucket: currentBucket,
      prefix: actualPrefix
    });
    
    const files = (result.objects || [])
      .filter((obj: any) => !obj.Key.endsWith('/'))
      .map((obj: any) => ({
        key: obj.Key,
        size: obj.Size,
        last_modified: obj.LastModified,
        storage_class: obj.StorageClass
      }));
    
    const folders = (result.folders || []).map((folder: any) => ({
      prefix: folder.Prefix
    }));
    
    return { files, folders };
  },

  async downloadFile(key: string): Promise<Uint8Array> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const result = await window.electronAPI.downloadFile({
      bucket: currentBucket,
      key
    });
    
    // For Electron, we'll return the download URL and let the browser handle it
    if (result.url) {
      await window.electronAPI.openUrl(result.url);
    }
    
    return new Uint8Array();
  },
  
  async downloadFileWithProgress(key: string, transferId: string, savePath?: string): Promise<boolean> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const result = await window.electronAPI.downloadFileWithProgress({
      bucket: currentBucket,
      key,
      transferId,
      savePath
    });
    
    return !result.canceled;
  },
  
  async downloadFiles(keys: string[], transferIds: string[]): Promise<boolean> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const result = await window.electronAPI.downloadFiles({
      bucket: currentBucket,
      keys,
      transferIds
    });
    
    return !result.canceled;
  },

  async uploadFile(key: string, data: Uint8Array): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    // If no key provided, we're doing a file dialog upload
    if (!key) {
      const filePaths = await window.electronAPI.openFileDialog();
      if (!filePaths || filePaths.length === 0) {
        throw new Error('No file selected');
      }
      
      // Upload all selected files to current directory
      for (const filePath of filePaths) {
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';
        const fullKey = currentPath + fileName;
        await window.electronAPI.uploadFile({
          bucket: currentBucket,
          key: fullKey,
          filePath: filePath
        });
      }
    } else {
      // Drag and drop or direct data upload - add current path
      const fullKey = currentPath + key;
      await window.electronAPI.uploadFile({
        bucket: currentBucket,
        key: fullKey,
        data: Array.from(data)
      });
    }
  },
  
  async uploadFileWithProgress(key: string, data: Uint8Array, transferId: string): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const fullKey = currentPath + key;
    await window.electronAPI.uploadFileWithProgress({
      bucket: currentBucket,
      key: fullKey,
      data: Array.from(data),
      transferId
    });
  },

  async deleteFile(key: string): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const result = await window.electronAPI.deleteFile({
      bucket: currentBucket,
      key
    });
    
    if (!result.success) {
      throw new Error('Failed to delete file');
    }
  },

  async loadSavedCredentials(): Promise<StoredCredentials | null> {
    const creds = await window.electronAPI.getCredentials();
    if (creds) {
      currentBucket = creds.bucket;
      return {
        access_key_id: creds.accessKeyId || creds.access_key_id,
        secret_access_key: creds.secretAccessKey || creds.secret_access_key,
        region: creds.region || '',
        bucket_name: creds.bucket || creds.bucket_name,
        endpoint_url: creds.endpoint_url || ''
      };
    }
    return null;
  },

  async clearCredentials(): Promise<void> {
    await window.electronAPI.clearCredentials();
    currentBucket = null;
    currentPath = '';
  },
  
  async createFolder(folderName: string): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const fullPath = currentPath + folderName;
    const result = await window.electronAPI.createFolder({
      bucket: currentBucket,
      folderName: fullPath
    });
    
    if (!result.success) {
      throw new Error('Failed to create folder');
    }
  },
  
  async deleteFolder(prefix: string): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const result = await window.electronAPI.deleteFolder({
      bucket: currentBucket,
      prefix
    });
    
    if (!result.success) {
      throw new Error('Failed to delete folder');
    }
  },
  
  async downloadFolder(prefix: string, folderName: string): Promise<boolean> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    const result = await window.electronAPI.downloadFolder({
      bucket: currentBucket,
      prefix,
      folderName
    });
    
    if (result.canceled) {
      return false;
    }
    
    if (!result.success) {
      throw new Error('Failed to download folder');
    }
    
    return true;
  },
  
  async renameFile(oldKey: string, newName: string): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    // Get the directory path from the old key
    const lastSlash = oldKey.lastIndexOf('/');
    const directory = lastSlash !== -1 ? oldKey.substring(0, lastSlash + 1) : '';
    const newKey = directory + newName;
    
    if (oldKey === newKey) {
      return; // No change needed
    }
    
    const result = await window.electronAPI.renameFile({
      bucket: currentBucket,
      oldKey,
      newKey
    });
    
    if (!result.success) {
      throw new Error('Failed to rename file');
    }
  },
  
  async renameFolder(oldPrefix: string, newName: string): Promise<void> {
    if (!currentBucket) {
      throw new Error('Not connected to S3');
    }
    
    // Get the parent directory path
    const withoutTrailingSlash = oldPrefix.endsWith('/') ? oldPrefix.slice(0, -1) : oldPrefix;
    const lastSlash = withoutTrailingSlash.lastIndexOf('/');
    const parentDirectory = lastSlash !== -1 ? withoutTrailingSlash.substring(0, lastSlash + 1) : '';
    const newPrefix = parentDirectory + newName + '/';
    
    if (oldPrefix === newPrefix) {
      return; // No change needed
    }
    
    const result = await window.electronAPI.renameFolder({
      bucket: currentBucket,
      oldPrefix,
      newPrefix
    });
    
    if (!result.success) {
      throw new Error('Failed to rename folder');
    }
  },

  async autoConnect(): Promise<boolean> {
    try {
      const creds = await this.loadSavedCredentials();
      if (creds) {
        await this.connect({
          access_key_id: creds.access_key_id,
          secret_access_key: creds.secret_access_key,
          region: creds.region,
          bucket_name: creds.bucket_name,
          endpoint_url: creds.endpoint_url
        });
        return true;
      }
    } catch (error) {
      // Silently fail auto-connect - user will see login form
      // Invalid credentials are expected on auto-connect
    }
    return false;
  },
};