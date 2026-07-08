'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Strip trailing [อ้างอิง 1] and render ** as bold for assistant messages
// Also convert URLs to clickable links
function formatMessageText(text: string, isAssistant: boolean): React.ReactNode {
  const stripped = text.replace(/\s*\[อ้างอิง\s*\d+\]\s*$/g, '').trim()
  if (!isAssistant) return stripped

  // First split by bold markers **
  const boldParts = stripped.split(/\*\*([^*]*)\*\*/g)

  return boldParts.map((part, i) => {
    const isBold = i % 2 === 1

    // For each part, detect and linkify URLs (including those with parentheses and www URLs)
    const urlRegex = /((?:https?:\/\/|www\.)[^\s<>]+?)(?=[\s<>]|$)/g
    const segments = part.split(urlRegex)

    const content = segments.map((seg, j) => {
      if (/^https?:\/\//i.test(seg)) {
        // Full URL - create link
        return (
          <a
            key={`${i}-${j}`}
            href={seg}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {seg}
          </a>
        )
      }
      if (/^www\./i.test(seg)) {
        // www URL - add https:// prefix
        return (
          <a
            key={`${i}-${j}`}
            href={`https://${seg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {seg}
          </a>
        )
      }
      return seg
    })

    if (isBold) {
      return <strong key={i}>{content}</strong>
    }
    return <span key={i}>{content}</span>
  })
}

// Generate or retrieve session ID
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return `anonymous-${Date.now()}`

  const storageKey = 'chatbot-session-id'
  let sessionId = localStorage.getItem(storageKey)

  if (!sessionId) {
    sessionId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(storageKey, sessionId)
  }

  return sessionId
}

const messagesKey = (sessionId: string) => `chatbot:messages:${sessionId}`
const sessionsIndexKey = 'chatbot:sessions'
const sidebarCollapsedKey = 'chatbot:sidebar-collapsed'

type ChatSessionIndexItem = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

function loadSessionsIndex(): ChatSessionIndexItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(sessionsIndexKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(
      (s: unknown): s is ChatSessionIndexItem =>
        typeof s === 'object' &&
        s !== null &&
        'id' in s &&
        'title' in s &&
        'createdAt' in s &&
        'updatedAt' in s
    )
    return valid
  } catch {
    return []
  }
}

function saveSessionsIndex(sessions: ChatSessionIndexItem[]) {
  try {
    localStorage.setItem(sessionsIndexKey, JSON.stringify(sessions))
  } catch {
    // ignore storage write errors
  }
}

function loadInitialMessages(sessionId: string): UIMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(messagesKey(sessionId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const looksLikeUIMessageArray = parsed.every(
      (m: unknown) =>
        typeof m === 'object' &&
        m !== null &&
        'id' in m &&
        'role' in m &&
        'parts' in m
    )
    return looksLikeUIMessageArray ? (parsed as UIMessage[]) : []
  } catch {
    return []
  }
}

function generateSessionId(): string {
  return `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function useViewport() {
  const [mounted, setMounted] = useState(false)
  const [size, setSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    setMounted(true)
    const update = () => {
      const w = window.innerWidth
      if (w < 640) setSize('mobile')
      else if (w < 1024) setSize('tablet')
      else setSize('desktop')
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return {
    mounted,
    size,
    isMobile: size === 'mobile',
    isTablet: size === 'tablet',
    isDesktop: size === 'desktop',
  }
}


function getResponsiveStyles(viewport: 'mobile' | 'tablet' | 'desktop') {
  const isMobile = viewport === 'mobile'
  const isTablet = viewport === 'tablet'

  return {
    // Header
    headerPadding: isMobile ? 'p-3' : 'p-4',
    headerTitle: isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-2xl',

    // Messages area
    msgPadding: isMobile ? 'px-2' : 'px-4',
    msgSpacing: isMobile ? 'space-y-2' : 'space-y-3',
    msgBubblePadding: isMobile ? 'px-3 py-2' : 'px-4 py-3',
    msgBubbleMaxWidth: isMobile ? 'max-w-[85%]' : 'max-w-md lg:max-w-lg xl:max-w-xl',
    msgTextSize: isMobile ? 'text-sm' : 'text-base',

    // References
    refSpacing: isMobile ? 'mt-2 space-y-1' : 'mt-3 space-y-2',
    refLabelSize: isMobile ? 'text-xs' : 'text-base',
    refLinkSize: isMobile ? 'text-sm' : 'text-lg',

    // Input
    inputPadding: isMobile ? 'py-2' : 'py-3',
    inputFormPadding: isMobile ? 'px-2' : 'px-4',
    textareaPadding: isMobile ? 'p-2' : 'p-4',
    textareaTextSize: isMobile ? 'text-sm' : 'text-lg',
    textareaRadius: isMobile ? 'rounded-xl' : 'rounded-2xl',
    sendBtnPadding: isMobile ? 'p-2' : 'p-4',
    sendBtnIconSize: isMobile ? 'w-4 h-4' : 'w-5 h-5',
    sidebarBtnPadding: isMobile ? 'p-2' : 'px-3 py-3',
    sidebarBtnIconSize: isMobile ? 'w-4 h-4' : 'w-5 h-5',

    // Sidebar
    sidebarWidth: 'w-72',

    // Status
    statusTextSize: isMobile ? 'text-base' : 'text-lg',
    statusPadding: isMobile ? 'px-2' : 'px-4',
  }
}

function ChatUI({
  sessionId,
  onMessagesChange,
  onToggleSidebar,
  viewport,
  sidebarCollapsed,
  onStatusChange,
}: {
  sessionId: string
  onMessagesChange: (messages: UIMessage[]) => void
  onToggleSidebar: () => void
  viewport: 'mobile' | 'tablet' | 'desktop'
  sidebarCollapsed: boolean
  onStatusChange?: (status: 'ready' | 'streaming') => void
}) {
  const styles = getResponsiveStyles(viewport)
  const isMobile = viewport === 'mobile'
  const hydratedRef = useRef(false)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/answercontext',
      headers: {
        'x-session-id': sessionId,
      },
    }),
  })

  useEffect(() => {
    onStatusChange?.(status === 'ready' ? 'ready' : 'streaming')
  }, [status, onStatusChange])

  // Add safety timeout to prevent infinite "กำลังพิมพ์..."
  useEffect(() => {
    if (status === 'streaming') {
      const timeout = setTimeout(() => {
        console.warn("Chat status stuck in streaming state, forcing ready")
        // Force status change by triggering a re-render
        onStatusChange?.('ready')
      }, 90000) // 90 seconds safety timeout
      
      return () => clearTimeout(timeout)
    }
  }, [status, onStatusChange])

  const [input, setInput] = useState('')

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const initial = loadInitialMessages(sessionId)
    if (initial.length > 0) {
      setMessages(initial)
    }
  }, [sessionId, setMessages])

  useEffect(() => {
    try {
      localStorage.setItem(messagesKey(sessionId), JSON.stringify(messages))
    } catch {
      // ignore storage write errors
    }
  }, [messages, sessionId])

  useEffect(() => {
    onMessagesChange(messages)
  }, [messages, onMessagesChange])

  //ไปที่ new bubble
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const BASE_HEIGHT = 56
  const MAX_HEIGHT = 200

  const lastBubbleRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollAfterSend = useRef(false)

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = `${BASE_HEIGHT}px`
    const next = Math.min(el.scrollHeight, MAX_HEIGHT)
    el.style.height = `${next}px`
  }

  useEffect(() => { adjustHeight() }, [])

  const scrollToLastBubble = (behavior: ScrollBehavior = 'smooth', block: ScrollLogicalPosition = 'nearest') => {
    lastBubbleRef.current?.scrollIntoView({ behavior, block })
  }

  useEffect(() => {
    if (pendingScrollAfterSend.current) {
      scrollToLastBubble('smooth', 'center')
      pendingScrollAfterSend.current = false
    }
  }, [messages])

  useEffect(() => {
    if (status === 'ready') {
      scrollToLastBubble('smooth', 'end')
    }
  }, [status])

  return (
    <div className={`h-full flex flex-col bg-indigo-900 ${isMobile ? 'pb-20' : ''}`}>

      <div className={`bg-slate-800 w-full ${styles.headerPadding} flex items-center justify-center text-center flex-shrink-0`}>
        <div className="w-full flex items-center gap-2">
          {isMobile && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Open sessions"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <h1 className={`text-white ${styles.headerTitle} flex-1`}>
            ยินดีต้อนรับสู่ระบบแชทบอทฝ่ายบุคคล (HR)
          </h1>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto overflow-x-hidden ${styles.msgPadding} py-3 min-h-0`}>
        {messages.length === 0 ? (
          <div className={`h-full w-full flex flex-col items-center justify-center text-center text-white ${styles.msgPadding}`}>
            <h1 className={styles.headerTitle}>สวัสดีค่ะ 🙏</h1>
            <p className={`mt-2 ${styles.msgTextSize}`}>ท่านสามารถถามคำถามได้เลยนะคะ 😊</p>
          </div>
        ) : (
          <div className={styles.msgSpacing}>
            {messages.map((m, i) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                ref={i === messages.length - 1 ? lastBubbleRef : undefined}
              >
                <div
                  className={`${styles.msgBubbleMaxWidth} ${styles.msgBubblePadding} rounded-2xl shadow-sm ${styles.msgTextSize} ${m.role === 'user' ? 'bg-blue-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md'}`}
                >
                  {m.parts.filter((p): p is typeof p & { type: 'text' } => p.type === 'text').map((part, j) => (
                    <div key={j} className="whitespace-pre-wrap break-words leading-relaxed">
                      {formatMessageText(part.text, m.role === 'assistant')}
                    </div>
                  ))}
                  {m.parts.find((p): p is typeof p & { type: 'data-rag-refs'; data: { mostRelevant: Array<{ id: number; url: string; title: string }>; maybeRelevant: Array<{ id: number; url: string; title: string }> } } => p.type === 'data-rag-refs') && (() => {
                    const refs = m.parts.find((p): p is typeof p & { type: 'data-rag-refs'; data: { mostRelevant: Array<{ id: number; url: string; title: string }>; maybeRelevant: Array<{ id: number; url: string; title: string }> } } => p.type === 'data-rag-refs')!
                    const { mostRelevant, maybeRelevant } = refs.data
                    return (
                      <div className={`${styles.refSpacing} pt-2 border-t border-gray-200`}>
                        {mostRelevant.length > 0 && (
                          <div>
                            <span className={`${styles.refLabelSize} font-medium text-gray-600`}>เอกสารอ้างอิงที่เกี่ยวข้องที่สุด:</span>
                            {mostRelevant.map((d, j) => (
                              d.url ? (
                                <a key={j} href={d.url} target="_blank" rel="noopener noreferrer" className={`mt-1 block ${styles.refLinkSize} text-blue-600 hover:underline`}>
                                  🔗 {d.title || d.url}
                                </a>
                              ) : (
                                <div key={j} className={`mt-1 block ${styles.refLinkSize} text-gray-700`}>
                                  📄 เอกสาร/เว็บไซต์ที่เกี่ยวข้องกับ {d.title}
                                </div>
                              )
                            ))}
                          </div>
                        )}
                        {maybeRelevant.length > 0 && (
                          <div>
                            <span className={`${styles.refLabelSize} font-medium text-gray-500`}>เอกสารที่อาจเกี่ยวข้อง:</span>
                            {maybeRelevant.map((d, j) => (
                              d.url ? (
                                <a key={j} href={d.url} target="_blank" rel="noopener noreferrer" className={`mt-1 block ${styles.refLinkSize} text-blue-500 hover:underline`}>
                                  🔗 {d.title || d.url}
                                </a>
                              ) : (
                                <div key={j} className={`mt-1 block ${styles.refLinkSize} text-gray-600`}>
                                  📄 เอกสาร/เว็บไซต์ที่เกี่ยวข้องกับ {d.title}
                                </div>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {!m.parts.some(p => p.type === 'data-rag-refs') && m.parts.some(p => p.type === 'source-url') && (
                    <div className={`${styles.refSpacing} pt-2 border-t border-gray-200`}>
                      <span className={`${styles.refLabelSize} font-medium text-gray-500`}>เอกสารอ้างอิง:</span>
                      {m.parts.filter((p): p is typeof p & { type: 'source-url'; url: string; title?: string } => p.type === 'source-url').map((part, j) => (
                        <a key={j} href={part.url} target="_blank" rel="noopener noreferrer" className={`mt-1 block ${styles.refLinkSize} text-blue-600 hover:underline`}>
                          🔗 {part.title ?? part.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {status !== 'ready' && (
              <div className={`text-white/80 ${styles.statusTextSize} ${styles.statusPadding} py-2`}>กำลังพิมพ์…</div>
            )}
          </div>
        )}
      </div>

      <div className={`bg-blue-700 ${styles.inputPadding} flex-shrink-0 justify-center ${isMobile ? 'fixed' : 'sticky'} bottom-0 left-0 right-0 z-30`}>
        <form
          className={`flex items-center gap-2 ${styles.inputFormPadding}`}
          onSubmit={(e) => {
            e.preventDefault()
            if (!input.trim()) return
            pendingScrollAfterSend.current = true
            sendMessage({ text: input })
            setInput('')
            requestAnimationFrame(() => {
              const el = textareaRef.current
              if (el) el.style.height = `${BASE_HEIGHT}px`
            })
          }}
        >
          {!isMobile && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`${styles.sidebarBtnPadding} rounded-xl bg-white/10 text-white text-sm hover:bg-white/15 transition-colors flex-shrink-0`}
            >
              {sidebarCollapsed ? <ChevronRight className={styles.sidebarBtnIconSize} /> : <ChevronLeft className={styles.sidebarBtnIconSize} />}
            </button>
          )}
          <textarea
            ref={textareaRef}
            className={`no-scrollbar flex flex-grow ${styles.textareaPadding} border border-white/20 text-white ${styles.textareaTextSize} ${styles.textareaRadius} focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-white/70 bg-transparent resize-none min-w-0`}
            value={input}
            placeholder="พิมพ์ข้อความ... (Shift+Enter ขึ้นบรรทัดใหม่)"
            onChange={(e) => {
              setInput(e.target.value)
              adjustHeight()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!input.trim()) return
                pendingScrollAfterSend.current = true
                sendMessage({ text: input })
                setInput('')
                requestAnimationFrame(() => {
                  const el = textareaRef.current
                  if (el) el.style.height = `${BASE_HEIGHT}px`
                })
              }
            }}
            disabled={status !== 'ready'}
            rows={1}
            style={{ height: `${BASE_HEIGHT}px`, maxHeight: `${MAX_HEIGHT}px` }}
          />
          <button
            type="submit"
            className={`${styles.sendBtnPadding} rounded-full bg-blue-500 text-white font-semibold hover:bg-sky-500 disabled:bg-blue-300 transition-colors flex-shrink-0`}
            disabled={status !== 'ready' || !input.trim()}
          >
            <svg className={styles.sendBtnIconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Chatbot() {
  const { mounted, size, isMobile } = useViewport()
  const storageKey = 'chatbot-session-id'
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId())
  const [sessions, setSessions] = useState<ChatSessionIndexItem[]>(() => loadSessionsIndex())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(sidebarCollapsedKey) === '1'
    } catch {
      return false
    }
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const existing = loadSessionsIndex()
    setSessions(existing)

    const activeId = getOrCreateSessionId()
    const hasActive = existing.some((s) => s.id === activeId)
    if (!hasActive) {
      const now = Date.now()
      const nextSessions: ChatSessionIndexItem[] = [
        { id: activeId, title: 'New chat', createdAt: now, updatedAt: now },
        ...existing,
      ]
      setSessions(nextSessions)
      saveSessionsIndex(nextSessions)
    }
  }, [])

  const handleMessagesChange = useCallback((messages: UIMessage[]) => {
    const now = Date.now()
    if (messages.length === 0) return

    const firstUserText = messages
      .filter((m) => m.role === 'user')
      .flatMap((m) => m.parts)
      .find((p) => p.type === 'text')

    const titleCandidate = firstUserText && firstUserText.type === 'text' ? firstUserText.text.trim() : ''
    const title = titleCandidate ? titleCandidate.slice(0, 30) : 'New chat'

    setSessions((prev) => {
      const current = prev.find((s) => s.id === sessionId)
      if (!current) return prev

      const nextTitle = current.title === 'New chat' ? title : current.title

      if (current.title === nextTitle) return prev

      const nextSessions = prev.map((s) =>
        s.id === sessionId ? { ...s, title: nextTitle, updatedAt: now } : s
      )
      saveSessionsIndex(nextSessions)
      return nextSessions
    })
  }, [sessionId])

  if (!mounted) {
    return (
      <div className="h-full flex bg-indigo-900 overflow-hidden">
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          <div className="h-full flex flex-col bg-indigo-900">
            <div className="bg-slate-800 w-full p-4 flex items-center justify-center text-center flex-shrink-0">
              <h1 className="text-white text-xl flex-1">
                ยินดีต้อนรับสู่ระบบแชทบอทฝ่ายบุคคล (HR)
              </h1>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 no-scrollbar min-h-0">
              <div className="h-full w-full flex flex-col items-center justify-center text-center text-white px-4">
                <h1 className="text-xl">สวัสดีค่ะ 🙏</h1>
                <p className="mt-2 text-base">ท่านสามารถถามคำถามได้เลยนะคะ 😊</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const setActiveSession = (id: string) => {
    try {
      localStorage.setItem(storageKey, id)
    } catch {
      // ignore
    }
    setSessionId(id)
  }

  const createNewSession = () => {
    const next = generateSessionId()
    const now = Date.now()

    setSessions((prev) => {
      const nextSessions: ChatSessionIndexItem[] = [
        { id: next, title: 'chat', createdAt: now, updatedAt: now },
        ...prev,
      ]
      saveSessionsIndex(nextSessions)
      return nextSessions
    })

    setActiveSession(next)
  }

  const deleteSession = (id: string) => {
    try {
      localStorage.removeItem(messagesKey(id))
    } catch {
      // ignore
    }

    setSessions((prev) => {
      const nextSessions = prev.filter((s) => s.id !== id)
      saveSessionsIndex(nextSessions)
      return nextSessions
    })

    if (id === sessionId) {
      const nextSessions = loadSessionsIndex().filter((s) => s.id !== id)
      if (nextSessions.length > 0) {
        setActiveSession(nextSessions[0].id)
      } else {
        createNewSession()
      }
    }
  }

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen((prev) => !prev)
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev
        try {
          localStorage.setItem(sidebarCollapsedKey, next ? '1' : '0')
        } catch {
          // ignore
        }
        return next
      })
    }
  }

  const closeMobileSidebar = () => setMobileSidebarOpen(false)

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-3 flex items-center gap-2">
        <button
          type="button"
          onClick={createNewSession}
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          title={isStreaming ? 'กรุณารอให้บอทตอบเสร็จก่อน' : ''}
        >
          New chat
        </button>
        <button
          type="button"
          onClick={() => deleteSession(sessionId)}
          disabled={isStreaming}
          className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-500 transition-colors disabled:bg-rose-400 disabled:cursor-not-allowed"
          title={isStreaming ? 'กรุณารอให้บอทตอบเสร็จก่อน' : ''}
        >
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedSessions.length === 0 ? (
          <div className="text-white/70 text-sm p-2">No sessions</div>
        ) : (
          sortedSessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (isStreaming) return
                setActiveSession(s.id)
                if (isMobile) closeMobileSidebar()
              }}
              disabled={isStreaming && s.id !== sessionId}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${s.id === sessionId ? 'bg-white/15' : 'hover:bg-white/10'
                } ${isStreaming && s.id !== sessionId ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isStreaming && s.id !== sessionId ? 'กรุณารอให้บอทตอบเสร็จก่อน' : ''}
            >
              <div className="font-medium truncate">{s.title || 'New chat'}</div>
              <div className="text-xs text-white/60 truncate">{new Date(s.updatedAt).toLocaleString()}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className="h-full flex bg-indigo-900 overflow-hidden" suppressHydrationWarning>
      {/* Desktop sidebar */}
      {!isMobile && !sidebarCollapsed && (
        <div className="w-72 bg-slate-900 text-white flex flex-col border-r border-white/10">
          <SidebarContent />
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeMobileSidebar}
          />
          <div className="fixed left-0 top-0 h-full w-72 bg-slate-900 text-white flex flex-col border-r border-white/10 z-50">
            <SidebarContent />
          </div>
        </>
      )}

      <div className="flex-1 h-full overflow-hidden flex flex-col">
        <ChatUI
          key={sessionId}
          sessionId={sessionId}
          onMessagesChange={handleMessagesChange}
          onToggleSidebar={toggleSidebar}
          viewport={size}
          sidebarCollapsed={sidebarCollapsed}
          onStatusChange={(status) => setIsStreaming(status === 'streaming')}
        />
      </div>
    </div>
  )
}