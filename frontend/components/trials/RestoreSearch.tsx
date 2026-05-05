"use client";

import { useEffect } from "react";

const STORAGE_KEY = "match_flow_v2";
const DISMISSED_KEY = "restore_search_dismissed";

export default function RestoreSearch() {
    useEffect(() => {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
            window.sessionStorage.removeItem(DISMISSED_KEY);
        } catch {
            /* ignore storage errors */
        }
    }, []);

    return null;
}
