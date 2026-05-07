"use client";
import dynamic from "next/dynamic";
const OSMMap = dynamic(() => import("./OSMMap"), { ssr: false });
export default OSMMap;


