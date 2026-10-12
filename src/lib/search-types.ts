export interface SearchResult {
  kind: "subject" | "material" | "assignment" | "exam";
  id: string;
  title: string;
  subjectName: string;
  subjectColor: string;
  snippet: string;
  meta: string;
  href: string;
}

export interface SearchGroup {
  kind: SearchResult["kind"];
  items: SearchResult[];
}
