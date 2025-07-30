import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { notFound } from "next/navigation";
import { marked } from "marked";

const postsDir = path.join(process.cwd(), "app/blog/posts");

export async function generateStaticParams() {
  const files = fs.readdirSync(postsDir).filter(file => file.endsWith(".md"));
  return files.map((filename) => ({
    slug: filename.replace(/\.md$/, ""),
  }));
}

export default async function Page({ params }: { params: { slug: Promise<{ slug: string[] }> } }) {
  const {slug} = await params
  
  const filePath = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContent);
  const html = marked(content);

  return (
    <article>
      <h1>{data.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}