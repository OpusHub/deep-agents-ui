import { useCallback, useMemo, useRef } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import { getDeployment } from "@/lib/environment/deployments";
import { v4 as uuidv4 } from "uuid";
import type { TodoItem } from "../types/types";
import { createClient } from "@/lib/client";
import { useAuthContext } from "@/providers/Auth";

type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
};

export function useChat(
  threadId: string | null,
  setThreadId: (
    value: string | ((old: string | null) => string | null) | null,
  ) => void,
  onTodosUpdate: (todos: TodoItem[]) => void,
  onFilesUpdate: (files: Record<string, string>) => void,
) {
  const deployment = useMemo(() => getDeployment(), []);
  const { session } = useAuthContext();
  const accessToken = session?.accessToken;

  // Use refs to avoid recreating callbacks when dependencies change
  const onTodosUpdateRef = useRef(onTodosUpdate);
  const onFilesUpdateRef = useRef(onFilesUpdate);
  const todosTimeoutRef = useRef<NodeJS.Timeout>();
  const filesTimeoutRef = useRef<NodeJS.Timeout>();

  // Update refs when callbacks change
  onTodosUpdateRef.current = onTodosUpdate;
  onFilesUpdateRef.current = onFilesUpdate;

  // Debounced update functions
  const debouncedTodosUpdate = useCallback((todos: TodoItem[]) => {
    if (todosTimeoutRef.current) {
      clearTimeout(todosTimeoutRef.current);
    }
    todosTimeoutRef.current = setTimeout(() => {
      onTodosUpdateRef.current(todos);
    }, 100); // 100ms debounce
  }, []);

  const debouncedFilesUpdate = useCallback((files: Record<string, string>) => {
    if (filesTimeoutRef.current) {
      clearTimeout(filesTimeoutRef.current);
    }
    filesTimeoutRef.current = setTimeout(() => {
      onFilesUpdateRef.current(files);
    }, 100); // 100ms debounce
  }, []);

  const agentId = useMemo(() => {
    if (!deployment?.agentId) {
      throw new Error(`No agent ID configured in environment`);
    }
    return deployment.agentId;
  }, [deployment]);

  const handleUpdateEvent = useCallback(
    (data: { [node: string]: Partial<StateType> }) => {
      try {
        console.log("Received update event:", data);
        Object.entries(data).forEach(([nodeName, nodeData]) => {
          console.log(`Processing node ${nodeName}:`, nodeData);
          if (nodeData?.todos) {
            console.log("Updating todos:", nodeData.todos);
            // Persist to localStorage as fallback
            try {
              localStorage.setItem(`thread_${threadId}_todos`, JSON.stringify(nodeData.todos));
            } catch (e) {
              console.warn("Failed to save todos to localStorage:", e);
            }
            debouncedTodosUpdate(nodeData.todos);
          }
          if (nodeData?.files) {
            console.log("Updating files:", Object.keys(nodeData.files));
            // Persist to localStorage as fallback
            try {
              localStorage.setItem(`thread_${threadId}_files`, JSON.stringify(nodeData.files));
            } catch (e) {
              console.warn("Failed to save files to localStorage:", e);
            }
            debouncedFilesUpdate(nodeData.files);
          }
        });
      } catch (error) {
        console.error("Error processing update event:", error);
      }
    },
    [threadId, debouncedTodosUpdate, debouncedFilesUpdate],
  );

  const stream = useStream<StateType>({
    assistantId: agentId,
    client: createClient(accessToken || ""),
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onUpdateEvent: handleUpdateEvent,
    onThreadId: setThreadId,
    onError: (error) => {
      console.error("Stream error:", error);
    },
    onConnect: () => {
      console.log("Stream connected");
    },
    onDisconnect: () => {
      console.log("Stream disconnected");
    },
    defaultHeaders: {
      "x-auth-scheme": "langsmith",
    },
  });

  const sendMessage = useCallback(
    (message: string) => {
      const humanMessage: Message = {
        id: uuidv4(),
        type: "human",
        content: message,
      };
      stream.submit(
        { messages: [humanMessage] },
        {
          optimisticValues(prev) {
            const prevMessages = prev.messages ?? [];
            const newMessages = [...prevMessages, humanMessage];
            return { ...prev, messages: newMessages };
          },
          config: {
            recursion_limit: 100,
          },
        },
      );
    },
    [stream],
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  return {
    messages: stream.messages,
    isLoading: stream.isLoading,
    sendMessage,
    stopStream,
  };
}
