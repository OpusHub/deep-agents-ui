"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, FileText, LoaderCircle, SquarePen, History } from "lucide-react";
import { ChatMessage } from "../ChatMessage/ChatMessage";
import { ThreadHistorySidebar } from "../ThreadHistorySidebar/ThreadHistorySidebar";
import { CopyFormSidebar } from "../CopyFormSidebar/CopyFormSidebar";
import type { SubAgent, TodoItem, ToolCall } from "../../types/types";
import { useChat } from "../../hooks/useChat";
import styles from "./CopyCreatorInterface.module.scss";
import { Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent } from "../../utils/utils";

interface CopyCreatorInterfaceProps {
  threadId: string | null;
  selectedSubAgent: SubAgent | null;
  setThreadId: (
    value: string | ((old: string | null) => string | null) | null,
  ) => void;
  onSelectSubAgent: (subAgent: SubAgent) => void;
  onTodosUpdate: (todos: TodoItem[]) => void;
  onFilesUpdate: (files: Record<string, string>) => void;
  onNewThread: () => void;
  isLoadingThreadState: boolean;
}

interface CopyFormData {
  clientName: string;
  region: string;
  service: string;
  hasOffer: boolean;
  offer?: string;
  clientPhone: string;
  includeReviews: boolean;
}

export const CopyCreatorInterface = React.memo<CopyCreatorInterfaceProps>(
  ({
    threadId,
    selectedSubAgent,
    setThreadId,
    onSelectSubAgent,
    onTodosUpdate,
    onFilesUpdate,
    onNewThread,
    isLoadingThreadState,
  }) => {
    const [input, setInput] = useState("");
    const [isThreadHistoryOpen, setIsThreadHistoryOpen] = useState(false);
    const [conversationStarted, setConversationStarted] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, isLoading, sendMessage, stopStream } = useChat(
      threadId,
      setThreadId,
      onTodosUpdate,
      onFilesUpdate,
    );

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
      if (messages.length > 0) {
        setConversationStarted(true);
      }
    }, [messages]);

    const handleSubmit = useCallback(
      (e: FormEvent) => {
        e.preventDefault();
        const messageText = input.trim();
        if (!messageText || isLoading) return;
        sendMessage(messageText);
        setInput("");
      },
      [input, isLoading, sendMessage],
    );

    const handleFormSubmit = useCallback((formData: CopyFormData) => {
      const prompt = `
Gere uma copy publicitária para o seguinte cliente:

**Dados do Cliente:**
- Nome: ${formData.clientName}
- Região: ${formData.region}  
- Serviço: ${formData.service}
- Telefone: ${formData.clientPhone}
- Tem oferta: ${formData.hasOffer ? 'Sim' : 'Não'}
${formData.offer ? `- Oferta: ${formData.offer}` : ''}
- Incluir reviews: ${formData.includeReviews ? 'Sim' : 'Não'}

Por favor, retorne a mesma copy com 3 hooks diferentes e salve cada variação em arquivos separados (hook1.txt, hook2.txt, hook3.txt).
      `.trim();

      sendMessage(prompt);
      setConversationStarted(true);
      setSelectedClient(formData);
    }, [sendMessage]);

    const handleNewThread = useCallback(() => {
      if (isLoading) {
        stopStream();
      }
      setIsThreadHistoryOpen(false);
      setConversationStarted(false);
      setSelectedClient(null);
      onNewThread();
    }, [isLoading, stopStream, onNewThread]);

    const handleThreadSelect = useCallback(
      (id: string) => {
        setThreadId(id);
        setIsThreadHistoryOpen(false);
      },
      [setThreadId],
    );

    const toggleThreadHistory = useCallback(() => {
      setIsThreadHistoryOpen((prev) => !prev);
    }, []);

    const hasMessages = messages.length > 0;

    const processedMessages = useMemo(() => {
      const messageMap = new Map<string, any>();
      messages.forEach((message: Message) => {
        if (message.type === "ai") {
          const toolCallsInMessage: any[] = [];
          if (
            message.additional_kwargs?.tool_calls &&
            Array.isArray(message.additional_kwargs.tool_calls)
          ) {
            toolCallsInMessage.push(...message.additional_kwargs.tool_calls);
          } else if (message.tool_calls && Array.isArray(message.tool_calls)) {
            toolCallsInMessage.push(
              ...message.tool_calls.filter(
                (toolCall: any) => toolCall.name !== "",
              ),
            );
          } else if (Array.isArray(message.content)) {
            const toolUseBlocks = message.content.filter(
              (block: any) => block.type === "tool_use",
            );
            toolCallsInMessage.push(...toolUseBlocks);
          }
          const toolCallsWithStatus = toolCallsInMessage.map(
            (toolCall: any) => {
              const name =
                toolCall.function?.name ||
                toolCall.name ||
                toolCall.type ||
                "unknown";
              const args =
                toolCall.function?.arguments ||
                toolCall.args ||
                toolCall.input ||
                {};
              return {
                id: toolCall.id || `tool-${Math.random()}`,
                name,
                args,
                status: "pending" as const,
              } as ToolCall;
            },
          );
          messageMap.set(message.id!, {
            message,
            toolCalls: toolCallsWithStatus,
          });
        } else if (message.type === "tool") {
          const toolCallId = message.tool_call_id;
          if (!toolCallId) {
            return;
          }
          for (const [, data] of messageMap.entries()) {
            const toolCallIndex = data.toolCalls.findIndex(
              (tc: any) => tc.id === toolCallId,
            );
            if (toolCallIndex === -1) {
              continue;
            }
            data.toolCalls[toolCallIndex] = {
              ...data.toolCalls[toolCallIndex],
              status: "completed" as const,
              result: extractStringFromMessageContent(message),
            };
            break;
          }
        } else if (message.type === "human") {
          messageMap.set(message.id!, {
            message,
            toolCalls: [],
          });
        }
      });
      const processedArray = Array.from(messageMap.values());
      return processedArray.map((data, index) => {
        const prevMessage =
          index > 0 ? processedArray[index - 1].message : null;
        return {
          ...data,
          showAvatar: data.message.type !== prevMessage?.type,
        };
      });
    }, [messages]);

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <FileText className={styles.logo} />
            <h1 className={styles.title}>Copy Creator Agent</h1>
            {conversationStarted && selectedClient && (
              <span className={styles.clientInfo}>
                - {selectedClient.clientName}
              </span>
            )}
          </div>
          <div className={styles.headerRight}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewThread}
              disabled={!hasMessages}
            >
              <SquarePen size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleThreadHistory}>
              <History size={20} />
            </Button>
          </div>
        </div>
        <div className={styles.content}>
          <ThreadHistorySidebar
            open={isThreadHistoryOpen}
            setOpen={setIsThreadHistoryOpen}
            currentThreadId={threadId}
            onThreadSelect={handleThreadSelect}
          />
          
          {!conversationStarted && (
            <CopyFormSidebar 
              onSubmit={handleFormSubmit}
              isLoading={isLoading}
            />
          )}

          <div className={styles.messagesContainer}>
            {!hasMessages && !isLoading && !isLoadingThreadState && (
              <div className={styles.emptyState}>
                <FileText size={48} className={styles.emptyIcon} />
                <h2>Gere copys publicitárias com 3 hooks diferentes</h2>
                <p>Preencha o formulário ao lado para começar</p>
              </div>
            )}
            {isLoadingThreadState && (
              <div className={styles.threadLoadingState}>
                <LoaderCircle className={styles.threadLoadingSpinner} />
              </div>
            )}
            <div className={styles.messagesList}>
              {processedMessages.map((data) => (
                <ChatMessage
                  key={data.message.id}
                  message={data.message}
                  toolCalls={data.toolCalls}
                  showAvatar={data.showAvatar}
                  onSelectSubAgent={onSelectSubAgent}
                  selectedSubAgent={selectedSubAgent}
                />
              ))}
              {isLoading && (
                <div className={styles.loadingMessage}>
                  <LoaderCircle className={styles.spinner} />
                  <span>Gerando copys...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
        
        {conversationStarted && (
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Continue a conversa... Ex: 'Pode fazer o hook 2 mais emocional?'"
              disabled={isLoading}
              className={styles.input}
            />
            {isLoading ? (
              <Button
                type="button"
                onClick={stopStream}
                className={styles.stopButton}
              >
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                className={styles.sendButton}
              >
                <Send size={16} />
              </Button>
            )}
          </form>
        )}
      </div>
    );
  },
);

CopyCreatorInterface.displayName = "CopyCreatorInterface";