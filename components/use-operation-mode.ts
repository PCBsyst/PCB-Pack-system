"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {hasEnvVars} from "@/lib/utils";
import {readOperationMode,type OperationModeResult} from "@/lib/operation-mode";
export function useOperationMode() {
  const [result,setResult]=useState<OperationModeResult>(hasEnvVars?{mode:"unavailable"}:{mode:"legacy"});
  useEffect(()=>{
    if(!hasEnvVars)return;
    let active=true, sequence=0;
    const load=async()=>{const request=++sequence;const next=await readOperationMode(createClient());if(active&&request===sequence)setResult(next);};
    void load();const timer=window.setInterval(()=>void load(),30000);
    window.addEventListener("operation-mode-changed",load);
    window.addEventListener("focus",load);
    return ()=>{active=false;window.clearInterval(timer);window.removeEventListener("operation-mode-changed",load);window.removeEventListener("focus",load);};
  },[]);
  return result;
}
