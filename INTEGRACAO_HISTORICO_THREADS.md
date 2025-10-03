# Integração de Histórico de Threads - LangGraph SDK

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Configuração do Cliente](#configuração-do-cliente)
3. [Gerenciamento de Threads](#gerenciamento-de-threads)
4. [Estrutura de Mensagens](#estrutura-de-mensagens)
5. [Implementação Passo a Passo](#implementação-passo-a-passo)
6. [Exemplos de Código](#exemplos-de-código)

---

## Visão Geral

Este documento explica como integrar o sistema de histórico de conversas usando o LangGraph SDK, permitindo:
- ✅ Criar novas threads de conversa
- ✅ Listar histórico de threads
- ✅ Carregar thread específica
- ✅ Enviar mensagens em threads existentes ou novas
- ✅ Sincronizar estado (mensagens, todos, files)

---

## Configuração do Cliente

### 1. Instalação
```bash
npm install @langchain/langgraph-sdk
```

### 2. Criar Cliente LangGraph
```typescript
import { Client } from "@langchain/langgraph-sdk";

export function createClient(accessToken: string) {
  return new Client({
    apiUrl: "https://sua-api.com",
    apiKey: accessToken,
    defaultHeaders: {
      "x-auth-scheme": "langsmith",
    },
  });
}
```

---

## Gerenciamento de Threads

### O que é uma Thread?
Uma **thread** é uma conversa isolada com seu próprio histórico de mensagens e estado. Cada thread tem:
- `thread_id`: ID único (UUID)
- `messages`: Array de mensagens (human, ai, tool)
- `state`: Estado customizado (todos, files, etc)
- `created_at`: Data de criação
- `updated_at`: Data de última atualização

### Ciclo de Vida de uma Thread

```
┌─────────────────┐
│  threadId: null │ ──► Nova Conversa
└─────────────────┘
         │
         ▼
    Enviar mensagem com client.runs.wait(null, ...)
         │
         ▼
┌──────────────────────┐
│ threadId: "uuid-123" │ ──► Thread Criada
└──────────────────────┘
         │
         ▼
    Mensagens subsequentes com client.runs.create(threadId, ...)
```

---

## Estrutura de Mensagens

### Tipos de Mensagem

A API do LangGraph retorna mensagens no formato:

```typescript
interface Message {
  id: string;                    // UUID da mensagem
  type: "human" | "ai" | "tool"; // Tipo da mensagem
  content: string | Array<any>;  // Conteúdo (string ou blocos)

  // Metadados opcionais
  name?: string;
  additional_kwargs?: {
    tool_calls?: Array<{
      id: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  tool_calls?: Array<any>;
  tool_call_id?: string; // Para mensagens do tipo "tool"
}
```

### Exemplo de Mensagens Reais

```javascript
// Mensagem do usuário
{
  id: "550e8400-e29b-41d4-a916-446655440000",
  type: "human",
  content: "Olá, como você está?"
}

// Resposta do assistente
{
  id: "550e8400-e29b-41d4-a916-446655440001",
  type: "ai",
  content: "Olá! Estou bem, obrigado. Como posso ajudar?"
}

// Mensagem com tool calls
{
  id: "550e8400-e29b-41d4-a916-446655440002",
  type: "ai",
  content: [
    { type: "text", text: "Vou buscar isso para você" },
    {
      type: "tool_use",
      id: "tool_123",
      name: "search",
      input: { query: "informação" }
    }
  ],
  tool_calls: [...]
}
```

### Extrair Texto de Mensagens

O conteúdo pode ser string ou array de blocos. Use esta função:

```typescript
export function extractStringFromMessageContent(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const textBlocks = message.content
      .filter(block => block.type === "text" || typeof block === "string")
      .map(block => typeof block === "string" ? block : block.text);

    return textBlocks.join(" ").trim();
  }

  return "";
}
```

---

## Implementação Passo a Passo

### 1. Enviar Mensagem (Nova Thread ou Existente)

```typescript
async function sendMessage(
  content: string,
  threadId: string | null,
  agentId: string,
  client: Client
) {
  const humanMessage = {
    id: uuidv4(),
    type: "human" as const,
    content,
  };

  let finalThreadId: string;
  let threadState: any;

  if (!threadId) {
    // ============================================
    // NOVA THREAD: usa wait() com threadId = null
    // ============================================
    const stateValues = await client.runs.wait(
      null,  // ← threadId null = criar nova thread
      agentId,
      {
        input: { messages: [humanMessage] },
        config: { recursion_limit: 100 },
      }
    );

    // wait() retorna values, busca thread mais recente para pegar ID
    const threads = await client.threads.search({ limit: 1 });
    finalThreadId = threads[0]?.thread_id || "";
    threadState = { values: stateValues };

  } else {
    // ===============================================
    // THREAD EXISTENTE: usa create() + join()
    // ===============================================
    const response = await client.runs.create(
      threadId,  // ← threadId específico
      agentId,
      {
        input: { messages: [humanMessage] },
        config: { recursion_limit: 100 },
      }
    );

    // Aguarda conclusão
    await client.runs.join(threadId, response.run_id);

    // Busca estado atualizado
    threadState = await client.threads.getState(threadId);
    finalThreadId = threadId;
  }

  return {
    threadId: finalThreadId,
    messages: threadState.values.messages || [],
    todos: threadState.values.todos || [],
    files: threadState.values.files || {},
  };
}
```

### 2. Buscar Histórico de Threads

```typescript
async function fetchThreadHistory(client: Client) {
  const response = await client.threads.search({
    limit: 30,
    sortBy: "created_at",
    sortOrder: "desc",
  });

  return response.map((thread) => ({
    id: thread.thread_id,
    title: extractFirstMessage(thread),
    createdAt: new Date(thread.created_at),
    updatedAt: new Date(thread.updated_at || thread.created_at),
  }));
}

function extractFirstMessage(thread: any): string {
  try {
    const messages = thread.values?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return extractStringFromMessageContent(messages[0]);
    }
  } catch (error) {
    console.warn("Failed to extract first message:", error);
  }
  return `Thread ${thread.thread_id.slice(0, 8)}`;
}
```

### 3. Carregar Thread Específica

```typescript
async function loadThread(threadId: string, client: Client) {
  const state = await client.threads.getState(threadId);

  return {
    messages: state.values?.messages || [],
    todos: state.values?.todos || [],
    files: state.values?.files || {},
  };
}
```

### 4. Criar Nova Thread (Limpar Estado)

```typescript
function startNewThread(setThreadId: (id: string | null) => void) {
  // Apenas setar threadId para null
  // Na próxima mensagem enviada, será criada automaticamente
  setThreadId(null);
}
```

---

## Exemplos de Código

### Hook Completo de Chat

```typescript
import { useState, useCallback, useEffect } from "react";
import { Client } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";

export function useChat(
  threadId: string | null,
  setThreadId: (id: string | null) => void,
  agentId: string,
  client: Client
) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Limpa mensagens quando threadId é null
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
    }
  }, [threadId]);

  // Envia mensagem
  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);

    const humanMessage = {
      id: uuidv4(),
      type: "human",
      content,
    };

    // Adiciona mensagem otimisticamente
    setMessages(prev => [...prev, humanMessage]);

    try {
      let finalThreadId: string;
      let threadState: any;

      if (!threadId) {
        // Nova thread
        const stateValues = await client.runs.wait(null, agentId, {
          input: { messages: [humanMessage] },
        });
        const threads = await client.threads.search({ limit: 1 });
        finalThreadId = threads[0]?.thread_id || "";
        threadState = { values: stateValues };
      } else {
        // Thread existente
        const run = await client.runs.create(threadId, agentId, {
          input: { messages: [humanMessage] },
        });
        await client.runs.join(threadId, run.run_id);
        threadState = await client.threads.getState(threadId);
        finalThreadId = threadId;
      }

      // Atualiza mensagens
      setMessages(threadState.values.messages || []);

      // Atualiza threadId se nova
      if (!threadId && finalThreadId) {
        setThreadId(finalThreadId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove mensagem otimista em caso de erro
      setMessages(prev => prev.filter(m => m.id !== humanMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [threadId, client, agentId, setThreadId]);

  // Carrega thread
  const loadThread = useCallback(async (targetThreadId: string) => {
    setIsLoading(true);
    try {
      const state = await client.threads.getState(targetThreadId);
      setMessages(state.values?.messages || []);
    } catch (error) {
      console.error("Error loading thread:", error);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return {
    messages,
    isLoading,
    sendMessage,
    loadThread,
  };
}
```

### Componente de Histórico de Threads

```typescript
function ThreadHistory({
  currentThreadId,
  onSelectThread,
  client
}) {
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    async function fetchThreads() {
      const response = await client.threads.search({
        limit: 30,
        sortBy: "created_at",
        sortOrder: "desc",
      });

      const threadList = response.map(thread => ({
        id: thread.thread_id,
        title: extractFirstMessage(thread),
        createdAt: new Date(thread.created_at),
        updatedAt: new Date(thread.updated_at),
      }));

      setThreads(threadList);
    }

    fetchThreads();
  }, [client, currentThreadId]);

  return (
    <div>
      <h3>Histórico</h3>
      {threads.map(thread => (
        <button
          key={thread.id}
          onClick={() => onSelectThread(thread.id)}
          className={thread.id === currentThreadId ? "active" : ""}
        >
          {thread.title}
        </button>
      ))}
    </div>
  );
}
```

---

## Resumo de Endpoints da API

| Operação | Método | Descrição |
|----------|--------|-----------|
| **Nova Thread** | `client.runs.wait(null, agentId, payload)` | Cria thread + executa + retorna state |
| **Enviar em Thread Existente** | `client.runs.create(threadId, agentId, payload)` | Cria run em thread existente |
| **Aguardar Conclusão** | `client.runs.join(threadId, runId)` | Aguarda run terminar |
| **Buscar Estado** | `client.threads.getState(threadId)` | Retorna state completo da thread |
| **Listar Threads** | `client.threads.search({ limit, sortBy })` | Lista threads do usuário |

---

## Fluxo Completo de Integração

```
┌──────────────────────────────────────────────────────────────┐
│ 1. INICIALIZAÇÃO                                             │
├──────────────────────────────────────────────────────────────┤
│ • Criar cliente LangGraph com apiUrl e accessToken           │
│ • Inicializar estado: threadId = null, messages = []         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. USUÁRIO ENVIA PRIMEIRA MENSAGEM                           │
├──────────────────────────────────────────────────────────────┤
│ • threadId === null?                                         │
│   ✓ SIM: client.runs.wait(null, ...)                        │
│   ✓ Criar nova thread automaticamente                        │
│   ✓ Buscar threadId em client.threads.search()              │
│   ✓ setThreadId(novoId)                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. MENSAGENS SUBSEQUENTES                                    │
├──────────────────────────────────────────────────────────────┤
│ • threadId !== null                                          │
│   ✓ client.runs.create(threadId, ...)                       │
│   ✓ client.runs.join(threadId, runId)                       │
│   ✓ client.threads.getState(threadId)                       │
│   ✓ Atualizar messages com state.values.messages            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. HISTÓRICO DE THREADS                                      │
├──────────────────────────────────────────────────────────────┤
│ • client.threads.search({ limit: 30 })                      │
│ • Exibir lista de threads                                    │
│ • Ao clicar: setThreadId(selectedId) + loadThread()         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. NOVA CONVERSA                                             │
├──────────────────────────────────────────────────────────────┤
│ • setThreadId(null)                                          │
│ • Limpar messages = []                                       │
│ • Próxima mensagem cria nova thread (volta ao passo 2)       │
└──────────────────────────────────────────────────────────────┘
```

---

## Checklist de Integração

- [ ] Instalar `@langchain/langgraph-sdk`
- [ ] Criar função `createClient()` com apiUrl e apiKey
- [ ] Implementar estado `threadId` (string | null)
- [ ] Implementar estado `messages` (Message[])
- [ ] Criar função `sendMessage()` com lógica de null vs threadId
- [ ] Criar função `loadThread()` para carregar histórico
- [ ] Criar função `startNewThread()` que seta threadId = null
- [ ] Implementar `client.threads.search()` para listar threads
- [ ] Adicionar `useEffect` para limpar messages quando threadId = null
- [ ] Testar criar nova thread, enviar mensagens, carregar histórico

---

## Diferenças Importantes

### ❌ NÃO FUNCIONA
```typescript
// Tentar criar run com threadId null
await client.runs.create(null, agentId, {...});
// ❌ Erro: Invalid UUID
```

### ✅ FUNCIONA
```typescript
// Nova thread: usar wait()
await client.runs.wait(null, agentId, {...});

// Thread existente: usar create()
await client.runs.create(threadId, agentId, {...});
```

---

## Possíveis Erros e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `Invalid UUID` | Passou `null` para `runs.create()` | Use `runs.wait(null, ...)` para novas threads |
| `Thread not found` | threadId inválido ou deletado | Verificar se thread existe antes de carregar |
| Mensagens duplicadas | Não limpa messages ao mudar threadId | Adicionar `useEffect` que limpa quando threadId muda |
| ThreadId não atualiza | Não busca thread após `wait()` | Buscar com `threads.search()` após criar |

---

## Conclusão

A integração com LangGraph SDK para histórico de threads requer:

1. **Cliente configurado** com apiUrl e accessToken
2. **Gerenciamento de threadId** (null = nova, string = existente)
3. **Métodos diferentes** para nova thread (`wait`) vs existente (`create`)
4. **Sincronização de estado** via `threads.getState()`
5. **Listagem de histórico** via `threads.search()`

Com esta estrutura, você pode integrar o sistema de threads em qualquer componente de chat existente, mantendo histórico persistente e permitindo múltiplas conversas simultâneas.
