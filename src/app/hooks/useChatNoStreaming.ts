import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function useChatNoStreaming(
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

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa mensagens quando threadId é null (nova thread)
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setError(null);
    }
  }, [threadId]);

  const agentId = useMemo(() => {
    if (!deployment?.agentId) {
      throw new Error(`No agent ID configured in environment`);
    }
    return deployment.agentId;
  }, [deployment]);

  const client = useMemo(() => {
    return createClient(accessToken || "");
  }, [accessToken]);

  /**
   * Envia mensagem e aguarda resposta completa (SEM STREAMING)
   */
  const sendMessage = useCallback(
    async (content: string) => {
      setIsLoading(true);
      setError(null);

      // Adiciona mensagem do usuário otimisticamente
      const humanMessage: Message = {
        id: uuidv4(),
        type: "human",
        content,
      };

      setMessages((prev) => [...prev, humanMessage]);

      try {
        console.log("Sending message without streaming...", { threadId, content });

        let finalThreadId: string;
        let threadState: any;

        if (!threadId) {
          // Nova thread: usa wait() que aceita null e retorna direto o state
          console.log("Creating new thread with wait()...");
          const stateValues = await client.runs.wait(
            null,
            agentId,
            {
              input: {
                messages: [humanMessage],
              },
              config: {
                recursion_limit: 100,
              },
            }
          );

          // wait() retorna só os values, precisamos buscar o threadId
          // Vamos fazer uma busca de threads recentes para pegar o ID
          const threads = await client.threads.search({ limit: 1 });
          finalThreadId = threads[0]?.thread_id || "";
          threadState = { values: stateValues };
          console.log("New thread created:", finalThreadId);
        } else {
          // Thread existente: usa create() + join()
          console.log("Using existing thread...");
          const response = await client.runs.create(
            threadId,
            agentId,
            {
              input: {
                messages: [humanMessage],
              },
              config: {
                recursion_limit: 100,
              },
            }
          );

          console.log("Run created:", response);
          await client.runs.join(threadId, response.run_id);
          console.log("Run completed, fetching thread state...");

          threadState = await client.threads.getState(threadId);
          finalThreadId = threadId;
        }

        console.log("Thread state received:", threadState);

        // Atualiza todas as mensagens
        if (threadState.values?.messages) {
          setMessages(threadState.values.messages);
        }

        // Atualiza todos se existirem
        if (threadState.values?.todos) {
          onTodosUpdate(threadState.values.todos);
        }

        // Atualiza files se existirem
        if (threadState.values?.files) {
          onFilesUpdate(threadState.values.files);
        }

        // Atualiza threadId se for nova thread
        if (!threadId && finalThreadId) {
          setThreadId(finalThreadId);
        }
      } catch (err: any) {
        const errorMessage = err.message || "Erro ao enviar mensagem";
        setError(errorMessage);
        console.error("Error sending message:", err);

        // Remove mensagem otimista em caso de erro
        setMessages((prev) => prev.filter((msg) => msg.id !== humanMessage.id));
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, accessToken, client, agentId, setThreadId, onTodosUpdate, onFilesUpdate]
  );

  /**
   * Carrega histórico de mensagens de uma thread
   */
  const loadThread = useCallback(
    async (targetThreadId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("Loading thread:", targetThreadId);
        const threadState = await client.threads.getState(targetThreadId);

        console.log("Thread state loaded:", threadState);

        if (threadState.values?.messages) {
          setMessages(threadState.values.messages);
        }

        if (threadState.values?.todos) {
          onTodosUpdate(threadState.values.todos);
        }

        if (threadState.values?.files) {
          onFilesUpdate(threadState.values.files);
        }
      } catch (err: any) {
        const errorMessage = err.message || "Erro ao carregar thread";
        setError(errorMessage);
        console.error("Error loading thread:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [client, onTodosUpdate, onFilesUpdate]
  );

  const stopStream = useCallback(() => {
    // No-op para compatibilidade com a interface atual
    console.log("Stop stream called (no-op for non-streaming mode)");
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    loadThread,
    stopStream,
    clearMessages,
  };
}
