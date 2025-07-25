import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Search, LogOut } from "lucide-react";
import { api } from "./lib/api";
import { ConnectForm } from "./components/ConnectForm";
import { FileList } from "./components/FileList";
import { FolderList } from "./components/FolderList";
import { UploadZone } from "./components/UploadZone";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { LoadingScreen } from "./components/LoadingScreen";
import { TransferProgress } from "./components/TransferProgress";
import { useTransferProgress } from "./hooks/useTransferProgress";

function App() {
  useTransferProgress();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    api.autoConnect().then((connected) => {
      setIsConnected(connected);
    });
  }, []);

  const { data: fileData = { files: [], folders: [] }, isLoading } = useQuery({
    queryKey: ["files", api.getCurrentPath()],
    queryFn: () => api.listFiles(),
    enabled: isConnected === true,
  });

  const filteredFiles = fileData.files.filter((file) =>
    file.key.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredFolders = fileData.folders.filter((folder) =>
    folder.prefix.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const disconnectMutation = useMutation({
    mutationFn: api.clearCredentials,
    onSuccess: () => {
      setIsConnected(false);
      queryClient.clear();
    },
  });

  if (isConnected === null) {
    return <LoadingScreen />;
  }

  if (!isConnected || showSettings) {
    return (
      <ConnectForm
        onConnect={() => {
          setIsConnected(true);
          setShowSettings(false);
        }}
        onCancel={showSettings ? () => setShowSettings(false) : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img src="./picto.svg" alt="v0lt" className="w-8 h-8" />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
              />
            </div>
            
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-zinc-600" />
            </button>
            
            <button
              onClick={() => disconnectMutation.mutate()}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Disconnect"
            >
              <LogOut className="w-5 h-5 text-zinc-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Breadcrumbs onNavigate={(path) => {
            api.setCurrentPath(path);
            queryClient.invalidateQueries({ queryKey: ["files"] });
          }} />
          
          <UploadZone onUpload={() => queryClient.invalidateQueries({ queryKey: ["files"] })}>
            <div>
              <FolderList
                folders={filteredFolders}
                onNavigate={(path) => {
                  api.setCurrentPath(path);
                  queryClient.invalidateQueries({ queryKey: ["files"] });
                }}
              />
              
              <FileList
                files={filteredFiles}
                isLoading={isLoading}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["files"] })}
              />
            </div>
          </UploadZone>
        </div>
      </div>
      
      <TransferProgress />
    </div>
  );
}

export default App;
