export type SearchEngine = {
  id: string;
  name: string;
  url: (q: string) => string;
  hostname: string;
  /** Origin used to look up the engine's favicon. */
  origin: string;
};

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    hostname: 'www.google.com',
    origin: 'https://www.google.com',
    url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'bing',
    name: 'Bing',
    hostname: 'www.bing.com',
    origin: 'https://www.bing.com',
    url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hostname: 'duckduckgo.com',
    origin: 'https://duckduckgo.com',
    url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'baidu',
    name: '百度',
    hostname: 'www.baidu.com',
    origin: 'https://www.baidu.com',
    url: q => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
  },
];

export function getEngine(id: string): SearchEngine {
  return SEARCH_ENGINES.find(e => e.id === id) ?? SEARCH_ENGINES[0];
}
