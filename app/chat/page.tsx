"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAuthUser } from "@/lib/auth";
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = loadAuthUser();
    if (!user) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#fa5a19] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <ChatInterface />
    </div>
  );
}
