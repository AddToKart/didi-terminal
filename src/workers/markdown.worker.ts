interface TocEntry {
  level: number;
  text: string;
  anchor: string;
}

function extractToc(text: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      toc.push({
        level: match[1].length,
        text: match[2].trim(),
        anchor: match[2].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      });
    }
  }
  return toc;
}

function renderMarkdownPreview(text: string): string {
  let html = text
    // Escaping angle brackets except for certain HTML tags
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Basic formatting
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-brand-accent px-1.5 py-0.5 rounded text-[11px]">$1</code>')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener">$1</a>')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 id="$1" class="text-lg font-bold mt-6 mb-2 text-zinc-200">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 id="$1" class="text-xl font-bold mt-8 mb-3 text-zinc-100">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 id="$1" class="text-2xl font-bold mt-10 mb-4 text-white">$1</h1>')
    // Quotes
    .replace(/^> (.*$)/gim, '<blockquote class="border-l-2 border-brand-accent/50 pl-4 py-1 my-4 text-zinc-400 bg-zinc-900/30 italic">$1</blockquote>')
    // Lists
    .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc marker:text-zinc-600 my-1">$1</li>')
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal marker:text-zinc-600 my-1">$1</li>');

  // Code blocks (multi-line)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-[#0b0b0d] border border-zinc-800 p-4 rounded-lg my-4 overflow-x-auto text-xs text-zinc-300"><code>$2</code></pre>');

  // Paragraphs (naive wrapper)
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('<') && !p.trim().startsWith('<a ') && !p.trim().startsWith('<strong') && !p.trim().startsWith('<em') && !p.trim().startsWith('<code')) {
      return p; // Already a block element
    }
    return p.trim() ? `<p class="mb-4 leading-relaxed">${p}</p>` : '';
  }).join('');

  return html;
}

self.onmessage = (e: MessageEvent<{ text: string }>) => {
  const { text } = e.data;
  
  const toc = extractToc(text);
  const html = renderMarkdownPreview(text);

  self.postMessage({ toc, html });
};