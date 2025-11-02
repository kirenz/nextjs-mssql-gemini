// src/components/ui/header.tsx
import { Bell, Settings } from "lucide-react";
import { Button } from "./button";

export function Header() {
  return (
    <header className="h-14 border-b bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Business Analytics</div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}