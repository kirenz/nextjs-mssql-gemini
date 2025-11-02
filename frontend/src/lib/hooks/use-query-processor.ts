// src/lib/hooks/use-query-processor.ts
import { useState, useCallback } from "react";
import { useWebSocket } from "@/lib/hooks/use-websocket";

interface QueryResponse {
  response?: string;
  error?: string;
}

export function useQueryProcessor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sendMessage, lastMessage } = useWebSocket();

  const processQuery = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Failed to process query');
      }

      const data: QueryResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refineQuery = useCallback(async (followUp: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ followUp }),
      });

      if (!response.ok) {
        throw new Error('Failed to refine query');
      }

      const data: QueryResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    processQuery,
    refineQuery,
    isLoading,
    error,
  };
}