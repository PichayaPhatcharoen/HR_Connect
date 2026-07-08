import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Simple markdown formatting
  const formatMarkdown = (text: string): string => {
    return text
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Line breaks
      .replace(/\n/g, '<br />')
      // Lists - bullet points
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')
      // Links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Raw URLs (not already in a tags)
      .replace(/(<a\b[^>]*>[\s\S]*?<\/a>)|((?:https?:\/\/|lin\.ee\/)[^\s<]+)/g, (match, aTag, url) => {
        if (aTag) return aTag;
        const cleanUrl = url.replace(/[.,);]+$/, '');
        const trailing = url.slice(cleanUrl.length);
        const href = cleanUrl.startsWith('lin.ee') ? `https://${cleanUrl}` : cleanUrl;
        return `<a href="${href}" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailing}`;
      })
  }

  return (
    <div
      className={cn("whitespace-pre-wrap", className)}
      dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
    />
  )
}
