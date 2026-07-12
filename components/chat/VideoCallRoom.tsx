"use client";

import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, Sparkles, PhoneOff, Settings, Shield } from "lucide-react";

interface VideoCallRoomProps {
  roomId?: string;
  userId?: string;
  userName?: string;
  onLeave?: () => void;
}

export default function VideoCallRoom({
  roomId = "pawbook-default-room",
  userId = "user-" + Math.floor(Math.random() * 1000),
  userName = "PawBook Member",
  onLeave
}: VideoCallRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Call Controls State
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [beautyEnabled, setBeautyEnabled] = useState(false);
  const [callActive, setCallActive] = useState(false);
  
  // Zego Instance
  const zegoInstanceRef = useRef<any>(null);

  // Soft beauty filter values
  const [skinSoftness, setSkinSoftness] = useState(60);
  const [brightness, setBrightness] = useState(110);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let zp: any = null;

    async function initCall() {
      try {
        // Dynamically import Zego Prebuilt UIKit on client-side to prevent Next.js SSR build crashes
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");

        const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || 123456789); // Fallback ID
        const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || "mock_server_secret_key_123456";

        // Generate Kit Token for testing
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomId,
          userId,
          userName
        );

        // Create prebuilt call instance
        zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        // Join video call room
        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnCameraWhenJoining: true,
          turnOnMicrophoneWhenJoining: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          useAppForwardsSplash: false,
          showScreenSharingButton: false,
          showUserList: false,
          showPreJoinView: false, // Direct join
          onLeaveRoom: () => {
            if (onLeave) onLeave();
          }
        });

        setCallActive(true);
      } catch (err) {
        console.error("❌ Error initializing ZEGOCLOUD call:", err);
      }
    }

    initCall();

    return () => {
      if (zp) {
        try {
          zp.destroy();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [roomId, userId, userName, onLeave]);

  // Handle local microphone mute/unmute
  const toggleMic = () => {
    if (zegoInstanceRef.current) {
      const nextState = !micEnabled;
      setMicEnabled(nextState);
      // Toggle microphone stream in Zego prebuilt
      zegoInstanceRef.current.muteMicrophone(!nextState);
    }
  };

  // Handle local camera toggle
  const toggleCamera = () => {
    if (zegoInstanceRef.current) {
      const nextState = !cameraEnabled;
      setCameraEnabled(nextState);
      // Toggle camera stream in Zego prebuilt
      zegoInstanceRef.current.mutePublishStreamVideo(!nextState);
    }
  };

  // Toggle Beauty Filter effect in the DOM video stream
  const toggleBeauty = () => {
    setBeautyEnabled(!beautyEnabled);
  };

  // Apply real-time CSS beauty filter adjustment overlays to native video elements
  useEffect(() => {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (beautyEnabled) {
        // Apply smooth blur, contrast, brightness, and soft glow
        const blurValue = (skinSoftness / 300).toFixed(2); // Soft skin smoothing blur
        video.style.filter = `brightness(${brightness}%) contrast(104%) saturate(102%) blur(${blurValue}px)`;
        video.style.transition = "filter 0.4s ease";
      } else {
        video.style.filter = "none";
      }
    });
  }, [beautyEnabled, skinSoftness, brightness, callActive]);

  const endCall = () => {
    if (zegoInstanceRef.current) {
      try {
        zegoInstanceRef.current.destroy();
      } catch (e) {}
    }
    if (onLeave) {
      onLeave();
    } else {
      window.location.reload(); // Reload or fallback
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between w-full h-[580px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      
      {/* Header Info Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between bg-slate-900/60 p-3 rounded-2xl backdrop-blur-md border border-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse"></div>
          <span className="text-xs font-bold text-slate-100 tracking-wide">Video Call 1-1</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-4xs font-semibold text-slate-300">Kết nối bảo mật bởi ZEGOCLOUD</span>
        </div>
      </div>

      {/* Main Video Prebuilt Call Frame Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full bg-slate-900/40"
        style={{ minHeight: "480px" }}
      />

      {/* Dynamic AI Beauty Settings Adjustment Overlay (Slide Panel) */}
      {beautyEnabled && (
        <div className="absolute right-4 top-20 z-20 w-52 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md space-y-3 animate-fadeIn">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
            <Sparkles className="h-4.5 w-4.5 text-amber-400" />
            <h4 className="text-3xs font-bold text-slate-200 uppercase">AI Beauty Filter</h4>
          </div>
          <div className="space-y-2 text-slate-300 text-4xs">
            <div>
              <div className="flex justify-between mb-1">
                <span>Làm mịn da (Skin Soft)</span>
                <span className="text-amber-400 font-bold">{skinSoftness}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={skinSoftness}
                onChange={(e) => setSkinSoftness(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Làm trắng/Sáng (Brightness)</span>
                <span className="text-amber-400 font-bold">{brightness}%</span>
              </div>
              <input
                type="range"
                min="90"
                max="140"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Call Custom Control Bar Overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-slate-900/90 py-3.5 px-6 rounded-full border border-slate-800/80 shadow-2xl backdrop-blur-md">
        
        {/* Toggle Mic Button */}
        <button
          onClick={toggleMic}
          className={`flex items-center justify-center h-10 w-10 rounded-full transition-all active:scale-95 cursor-pointer ${
            micEnabled 
              ? "bg-slate-800 hover:bg-slate-700 text-slate-100" 
              : "bg-rose-500/20 text-rose-500 border border-rose-500/30"
          }`}
          title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
        >
          {micEnabled ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
        </button>

        {/* Toggle Camera Button */}
        <button
          onClick={toggleCamera}
          className={`flex items-center justify-center h-10 w-10 rounded-full transition-all active:scale-95 cursor-pointer ${
            cameraEnabled 
              ? "bg-slate-800 hover:bg-slate-700 text-slate-100" 
              : "bg-rose-500/20 text-rose-500 border border-rose-500/30"
          }`}
          title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
        >
          {cameraEnabled ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
        </button>

        {/* Toggle Beauty Filter Button */}
        <button
          onClick={toggleBeauty}
          className={`flex items-center justify-center h-10 w-10 rounded-full transition-all active:scale-95 cursor-pointer ${
            beautyEnabled 
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 border border-amber-400/20" 
              : "bg-slate-800 hover:bg-slate-700 text-slate-350"
          }`}
          title="Bật/Tắt Beauty Filter"
        >
          <Sparkles className="h-4.5 w-4.5" />
        </button>

        {/* End Call Button */}
        <button
          onClick={endCall}
          className="flex items-center justify-center h-10 w-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95 cursor-pointer shadow-lg shadow-rose-650/20"
          title="Kết thúc cuộc gọi"
        >
          <PhoneOff className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
