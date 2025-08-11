import { useCallback, useMemo } from "react"
import { useStream } from "@langchain/langgraph-sdk/react"
import { type Message } from "@langchain/langgraph-sdk"
import { getDeployment } from "@/lib/environment/deployments"
import { v4 as uuidv4 } from "uuid"
import type { TodoItem } from "../types/types"

type StateType = {
  messages: Message[]
  todos: TodoItem[]
  files: Record<string, string>
}

export function useChat(
  threadId: string | null,
  setThreadId: (value: string | ((old: string | null) => string | null) | null) => void,
  onTodosUpdate: (todos: TodoItem[]) => void,
  onFilesUpdate: (files: Record<string, string>) => void
) {
  const deployment = useMemo(() => getDeployment(), [])

  const deploymentUrl = useMemo(() => {
    if (!deployment?.deploymentUrl) {
      throw new Error(`No deployment URL configured in environment`)
    }
    return deployment.deploymentUrl
  }, [deployment])

  const agentId = useMemo(() => {
    if (!deployment?.agentId) {
      throw new Error(`No agent ID configured in environment`)
    }
    return deployment.agentId
  }, [deployment])
  
  const handleUpdateEvent = useCallback((data: { [node: string]: Partial<StateType> }) => {
    Object.entries(data).forEach(([_, nodeData]) => {
      if (nodeData?.todos) {
        onTodosUpdate(nodeData.todos)
      }
      if (nodeData?.files) {
        onFilesUpdate(nodeData.files)
      }
    })
  }, [onTodosUpdate, onFilesUpdate])
  
  const stream = useStream<StateType>({
    apiUrl: deploymentUrl,
    assistantId: agentId,
    threadId: threadId ?? null,
    onUpdateEvent: handleUpdateEvent,
    onThreadId: setThreadId,
    defaultHeaders: {
      "x-auth-scheme": "langsmith",
    },
  })
  
  const sendMessage = useCallback((message: string) => {
    const humanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: message,
    }
    stream.submit({ messages: [humanMessage] }, {
      config: {
        recursion_limit: 100,
      },
    })
  }, [stream])
  
  const stopStream = useCallback(() => {
    stream.stop()
  }, [stream])

  return {
    messages: stream.messages,
    isLoading: stream.isLoading,
    sendMessage,
    stopStream,
  }
}