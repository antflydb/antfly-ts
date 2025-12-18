import { Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiConfig } from "@/hooks/use-api-config";

export function SettingsDialog() {
  const { apiUrl, setApiUrl, resetToDefault } = useApiConfig();
  const [tempUrl, setTempUrl] = useState(apiUrl);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = () => {
    setApiUrl(tempUrl);
    setIsOpen(false);
  };

  const handleReset = () => {
    resetToDefault();
    setTempUrl(apiUrl);
  };

  const handleCancel = () => {
    setTempUrl(apiUrl);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-131.25">
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription>
            Configure the Antfly server to connect to. This is useful when accessing the dashboard
            remotely or connecting to a different server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <Input
              id="api-url"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="http://localhost:8082/api/v1"
            />
            <p className="text-sm text-muted-foreground">
              Current: <code className="text-xs bg-muted px-1 py-0.5 rounded">{apiUrl}</code>
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Examples</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                • Local:{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  http://localhost:8082/api/v1
                </code>
              </div>
              <div>
                • Remote:{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  http://server.example.com:8082/api/v1
                </code>
              </div>
              <div>
                • Same server (default):{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/v1</code>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Default
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
