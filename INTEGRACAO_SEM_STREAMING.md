  # Documentação: Integração com LangGraph sem Streaming

  ## Visão Geral

  Esta documentação explica como implementar uma interface de chat integrada com o servidor LangGraph **sem usar streaming**, apenas com requisições HTTP simples que retornam JSON completo.

  ---

  ## 1. Arquitetura Atual (Com Streaming)

  A aplicação atual usa o hook `useStream` do `@langchain/langgraph-sdk/react` que:
  - Conecta via WebSocket ao servidor LangGraph
  - Recebe mensagens em tempo real conforme são geradas
  - Atualiza a UI progressivamente

  **Componentes principais:**
  - `useChat` (hook): Gerencia streaming, mensagens e estado
  - `ChatInterface`: UI do chat
  - `ChatMessage`: Renderiza cada mensagem
  - `ThreadHistorySidebar`: Exibe histórico de conversas

  ---

  ## 2. Adaptação para Modelo Sem Streaming

  ### 2.1 Configuração do Cliente

  ```typescript
  // lib/client.ts
  import { Client } from "@langchain/langgraph-sdk";

  export function createClient(accessToken: string) {
    return new Client({
      apiUrl: process.env.NEXT_PUBLIC_DEPLOYMENT_URL || "http://127.0.0.1:2024",
      apiKey: accessToken,
      defaultHeaders: {
        "x-auth-scheme": "langsmith",
      },
    });
  }
  ```

  ### 2.2 Hook Customizado (Sem Streaming)

  ```typescript
  // hooks/useChat.ts
  import { useState, useCallback } from "react";
  import { type Message } from "@langchain/langgraph-sdk";
  import { createClient } from "@/lib/client";
  import { v4 as uuidv4 } from "uuid";

  interface ChatState {
    messages: Message[];
    todos: TodoItem[];
    files: Record<string, string>;
  }

  export function useChat(
    threadId: string | null,
    setThreadId: (value: string | null) => void,
    accessToken: string
  ) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const client = createClient(accessToken);

    /**
     * Envia mensagem e aguarda resposta completa
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
          // Requisição para o servidor (SEM STREAMING)
          const response = await client.runs.create(
            threadId,
            process.env.NEXT_PUBLIC_AGENT_ID || "deepagent",
            {
              input: {
                messages: [humanMessage],
              },
              config: {
                recursion_limit: 100,
              },
              // Importante: streamMode null ou "values" para resposta completa
              streamMode: "values",
            }
          );

          // Aguarda conclusão do run
          await client.runs.join(threadId, response.run_id);

          // Busca o estado final da thread
          const threadState = await client.threads.getState(threadId);

          // Atualiza todas as mensagens
          if (threadState.values?.messages) {
            setMessages(threadState.values.messages);
          }

          // Atualiza threadId se for nova thread
          if (!threadId && response.thread_id) {
            setThreadId(response.thread_id);
          }
        } catch (err: any) {
          setError(err.message || "Erro ao enviar mensagem");
          console.error("Erro:", err);
        } finally {
          setIsLoading(false);
        }
      },
      [threadId, accessToken, client]
    );

    /**
     * Carrega histórico de mensagens de uma thread
     */
    const loadThread = useCallback(
      async (targetThreadId: string) => {
        setIsLoading(true);
        setError(null);

        try {
          const threadState = await client.threads.getState(targetThreadId);

          if (threadState.values?.messages) {
            setMessages(threadState.values.messages);
          }
        } catch (err: any) {
          setError(err.message || "Erro ao carregar thread");
          console.error("Erro:", err);
        } finally {
          setIsLoading(false);
        }
      },
      [client]
    );

    return {
      messages,
      isLoading,
      error,
      sendMessage,
      loadThread,
    };
  }
  ```

  ### 2.3 Componente de Chat

  ```tsx
  // components/ChatInterface.tsx
  "use client";

  import React, { useState, useEffect, FormEvent } from "react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Send, Bot } from "lucide-react";
  import { ChatMessage } from "./ChatMessage";
  import { useChat } from "../hooks/useChat";

  interface ChatInterfaceProps {
    threadId: string | null;
    setThreadId: (value: string | null) => void;
    accessToken: string;
  }

  export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    threadId,
    setThreadId,
    accessToken,
  }) => {
    const [input, setInput] = useState("");
    const { messages, isLoading, error, sendMessage, loadThread } = useChat(
      threadId,
      setThreadId,
      accessToken
    );

    // Carrega thread quando threadId muda
    useEffect(() => {
      if (threadId) {
        loadThread(threadId);
      }
    }, [threadId, loadThread]);

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      const messageText = input.trim();
      if (!messageText || isLoading) return;

      await sendMessage(messageText);
      setInput("");
    };

    return (
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="border-b p-4">
          <h1 className="text-xl font-bold">Chat Interface</h1>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-gray-500">
              <Bot size={48} />
              <p>Inicie uma nova conversa</p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin">⏳</div>
              <span>Processando...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            <Send size={16} />
          </Button>
        </form>
      </div>
    );
  };
  ```

  ---

  ## 3. Gerenciamento de Histórico

  ### 3.1 Histórico de Threads (Conversas)

  ```typescript
  // hooks/useThreadHistory.ts
  import { useState, useCallback, useEffect } from "react";
  import { createClient } from "@/lib/client";

  interface Thread {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export function useThreadHistory(accessToken: string) {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const client = createClient(accessToken);

    const fetchThreads = useCallback(async () => {
      setIsLoading(true);
      try {
        // Busca últimas 30 threads
        const response = await client.threads.search({
          limit: 30,
          sortBy: "created_at",
          sortOrder: "desc",
        });

        const threadList: Thread[] = response.map((thread: any) => {
          // Usa primeira mensagem como título
          let title = `Thread ${thread.thread_id.slice(0, 8)}`;

          if (thread.values?.messages && thread.values.messages.length > 0) {
            const firstMessage = thread.values.messages[0];
            title = typeof firstMessage.content === "string"
              ? firstMessage.content.slice(0, 50)
              : `Thread ${thread.thread_id.slice(0, 8)}`;
          }

          return {
            id: thread.thread_id,
            title,
            createdAt: new Date(thread.created_at),
            updatedAt: new Date(thread.updated_at || thread.created_at),
          };
        });

        setThreads(threadList);
      } catch (error) {
        console.error("Erro ao buscar threads:", error);
      } finally {
        setIsLoading(false);
      }
    }, [client]);

    useEffect(() => {
      fetchThreads();
    }, [fetchThreads]);

    return {
      threads,
      isLoading,
      refreshThreads: fetchThreads,
    };
  }
  ```

  ### 3.2 Componente de Histórico

  ```tsx
  // components/ThreadHistorySidebar.tsx
  import React from "react";
  import { MessageSquare } from "lucide-react";
  import { useThreadHistory } from "../hooks/useThreadHistory";

  interface ThreadHistorySidebarProps {
    accessToken: string;
    currentThreadId: string | null;
    onThreadSelect: (threadId: string) => void;
  }

  export const ThreadHistorySidebar: React.FC<ThreadHistorySidebarProps> = ({
    accessToken,
    currentThreadId,
    onThreadSelect,
  }) => {
    const { threads, isLoading } = useThreadHistory(accessToken);

    // Agrupa threads por período
    const groupedThreads = threads.reduce(
      (acc, thread) => {
        const now = new Date();
        const diff = now.getTime() - thread.updatedAt.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) acc.today.push(thread);
        else if (days === 1) acc.yesterday.push(thread);
        else if (days < 7) acc.week.push(thread);
        else acc.older.push(thread);

        return acc;
      },
      { today: [], yesterday: [], week: [], older: [] } as Record<string, any[]>
    );

    if (isLoading) {
      return <div>Carregando threads...</div>;
    }

    return (
      <div className="w-64 border-r p-4 overflow-y-auto">
        <h3 className="font-bold mb-4">Histórico</h3>

        {threads.length === 0 ? (
          <div className="text-center text-gray-500">
            <MessageSquare size={32} />
            <p>Nenhuma conversa ainda</p>
          </div>
        ) : (
          <>
            {/* Hoje */}
            {groupedThreads.today.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Hoje</h4>
                {groupedThreads.today.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === currentThreadId}
                    onClick={() => onThreadSelect(thread.id)}
                  />
                ))}
              </div>
            )}

            {/* Ontem */}
            {groupedThreads.yesterday.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Ontem</h4>
                {groupedThreads.yesterday.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === currentThreadId}
                    onClick={() => onThreadSelect(thread.id)}
                  />
                ))}
              </div>
            )}

            {/* Esta Semana */}
            {groupedThreads.week.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Esta Semana</h4>
                {groupedThreads.week.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === currentThreadId}
                    onClick={() => onThreadSelect(thread.id)}
                  />
                ))}
              </div>
            )}

            {/* Mais Antigos */}
            {groupedThreads.older.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Mais Antigos</h4>
                {groupedThreads.older.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === currentThreadId}
                    onClick={() => onThreadSelect(thread.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const ThreadItem: React.FC<{
    thread: any;
    isActive: boolean;
    onClick: () => void;
  }> = ({ thread, isActive, onClick }) => {
    return (
      <button
        onClick={onClick}
        className={`
          w-full text-left p-2 rounded mb-1 flex items-center gap-2
          ${isActive ? "bg-blue-100" : "hover:bg-gray-100"}
        `}
      >
        <MessageSquare size={16} />
        <div className="flex-1 truncate text-sm">{thread.title}</div>
      </button>
    );
  };
  ```

  ---

  ## 4. Estrutura de Dados

  ### 4.1 Tipos TypeScript

  ```typescript
  // types/types.ts

  // Mensagem do LangGraph
  export interface Message {
    id: string;
    type: "human" | "ai" | "tool" | "system";
    content: string | any;
    additional_kwargs?: any;
    tool_calls?: any[];
    tool_call_id?: string;
  }

  // Thread (conversa)
  export interface Thread {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }

  // Estado da Thread
  export interface ThreadState {
    messages: Message[];
    todos?: TodoItem[];
    files?: Record<string, string>;
  }

  // TodoItem (tarefas)
  export interface TodoItem {
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed";
  }
  ```

  ---

  ## 5. API do LangGraph SDK

  ### 5.1 Endpoints Principais

  #### Criar/Enviar Mensagem
  ```typescript
  const response = await client.runs.create(
    threadId,          // null para nova thread
    agentId,           // ID do agente
    {
      input: {
        messages: [{ id: "...", type: "human", content: "..." }]
      },
      config: {
        recursion_limit: 100
      },
      streamMode: "values"  // "values" para resposta completa
    }
  );
  ```

  #### Aguardar Conclusão
  ```typescript
  await client.runs.join(threadId, runId);
  ```

  #### Buscar Estado da Thread
  ```typescript
  const state = await client.threads.getState(threadId);
  // state.values.messages -> array de mensagens
  ```

  #### Buscar Threads
  ```typescript
  const threads = await client.threads.search({
    limit: 30,
    sortBy: "created_at",
    sortOrder: "desc"
  });
  ```

  ---

  ## 6. Fluxo Completo de Mensagem

  ```
  1. Usuário digita mensagem
    ↓
  2. Adiciona mensagem humana à UI (otimista)
    ↓
  3. Envia para servidor via client.runs.create()
    ↓
  4. Aguarda processamento com client.runs.join()
    ↓
  5. Busca estado completo com client.threads.getState()
    ↓
  6. Atualiza UI com todas as mensagens
  ```

  ---

  ## 7. Fluxo de Histórico

  ```
  1. Componente monta ou usuário abre sidebar
    ↓
  2. Busca threads com client.threads.search()
    ↓
  3. Agrupa threads por período (hoje, ontem, semana, antigos)
    ↓
  4. Exibe lista de threads
    ↓
  5. Usuário clica em thread
    ↓
  6. Carrega mensagens com client.threads.getState()
  ```

  ---

  ## 8. Exemplo Completo de Integração

  ```typescript
  // App.tsx
  "use client";

  import { useState } from "react";
  import { ChatInterface } from "./components/ChatInterface";
  import { ThreadHistorySidebar } from "./components/ThreadHistorySidebar";

  export default function App() {
    const [threadId, setThreadId] = useState<string | null>(null);
    const accessToken = "your-access-token"; // Buscar de autenticação

    return (
      <div className="flex h-screen">
        {/* Sidebar de Histórico */}
        <ThreadHistorySidebar
          accessToken={accessToken}
          currentThreadId={threadId}
          onThreadSelect={(id) => setThreadId(id)}
        />

        {/* Interface de Chat */}
        <div className="flex-1">
          <ChatInterface
            threadId={threadId}
            setThreadId={setThreadId}
            accessToken={accessToken}
          />
        </div>
      </div>
    );
  }
  ```

  ---

  ## 9. Variáveis de Ambiente

  ```env
  # .env.local
  NEXT_PUBLIC_DEPLOYMENT_URL=http://127.0.0.1:2024
  NEXT_PUBLIC_AGENT_ID=deepagent
  ```

  ---

  ## 10. Diferenças Entre Streaming e Sem Streaming

  | Aspecto | Com Streaming | Sem Streaming |
  |---------|---------------|---------------|
  | **Conexão** | WebSocket | HTTP |
  | **Hook** | `useStream` | Custom hook |
  | **Resposta** | Progressiva | Completa ao final |
  | **UX** | Atualização em tempo real | Loading até resposta completa |
  | **Complexidade** | Maior | Menor |
  | **Método SDK** | `stream.submit()` | `client.runs.create()` |

  ---

  ## 11. Considerações de Performance

  ### Com Streaming:
  - ✅ Feedback imediato ao usuário
  - ✅ Melhor UX para respostas longas
  - ❌ Mais complexo de implementar
  - ❌ Requer WebSocket

  ### Sem Streaming:
  - ✅ Implementação mais simples
  - ✅ Funciona com HTTP básico
  - ✅ Mais fácil de fazer cache
  - ❌ Usuário aguarda resposta completa
  - ❌ Sem feedback progressivo

  ---

  ## 12. Checklist de Implementação

  - [ ] Configurar cliente LangGraph
  - [ ] Criar hook `useChat` customizado
  - [ ] Implementar componente `ChatInterface`
  - [ ] Implementar componente `ChatMessage`
  - [ ] Criar hook `useThreadHistory`
  - [ ] Implementar `ThreadHistorySidebar`
  - [ ] Configurar variáveis de ambiente
  - [ ] Implementar sistema de autenticação
  - [ ] Testar envio de mensagens
  - [ ] Testar carregamento de histórico
  - [ ] Implementar tratamento de erros
  - [ ] Adicionar loading states
  - [ ] Implementar criação de nova thread

  ---

  ## 13. Recursos Adicionais

  - **Documentação LangGraph SDK**: https://langchain-ai.github.io/langgraphjs/
  - **API Reference**: https://langchain-ai.github.io/langgraphjs/reference/
  - **Exemplo Oficial**: https://github.com/langchain-ai/langgraphjs/tree/main/examples

  ---

  ## 14. Troubleshooting

  ### Erro: "Thread not found"
  - Verificar se `threadId` está correto
  - Garantir que thread existe no servidor

  ### Erro: "Unauthorized"
  - Verificar `accessToken`
  - Confirmar header `x-auth-scheme`

  ### Mensagens não carregam
  - Verificar formato de resposta do servidor
  - Confirmar que `state.values.messages` existe

  ### Histórico vazio
  - Verificar se há threads criadas
  - Confirmar parâmetros de busca

  ---

  ## Conclusão

  Esta documentação fornece todos os componentes e lógica necessários para implementar uma interface de chat integrada ao LangGraph **sem streaming**, usando apenas requisições HTTP síncronas. A implementação é mais simples que a versão com streaming, mas ainda mantém todas as funcionalidades essenciais como histórico de mensagens, histórico de threads e gerenciamento de estado.
