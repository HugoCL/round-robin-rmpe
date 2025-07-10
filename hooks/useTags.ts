"use client";

import { useState, useEffect, useCallback } from "react";
import { getTags, type Tag } from "@/app/[locale]/actions";

export function useTags() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTags = async () => {
            try {
                const tagsData = await getTags();
                setTags(tagsData);
            } catch (error) {
                console.error("Error loading tags:", error);
            } finally {
                setLoading(false);
            }
        };

        loadTags();
    }, []);

    const refreshTags = useCallback(async () => {
        try {
            setLoading(true);
            const tagsData = await getTags();
            setTags(tagsData);
        } catch (error) {
            console.error("Error refreshing tags:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        tags,
        loading,
        refreshTags,
        hasTags: tags.length > 0,
    };
}
