import { defineCollection, defineConfig } from '@content-collections/core';
import { compileMarkdown } from '@content-collections/markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import type { Root, Element, Text, ElementContent } from 'hast';
import { visit } from 'unist-util-visit';
import * as v from 'valibot';

const CALLOUT_LABELS = {
	note: 'メモ',
	tip: 'ヒント',
	warning: '注意',
	important: '重要',
	caution: '警告'
} as const;
type CalloutType = keyof typeof CALLOUT_LABELS;

// Transforms GitHub-style `> [!TYPE]` blockquotes into `.callout` divs.
function rehypeCallouts() {
	return (tree: Root) => {
		visit(tree, 'element', (node: Element) => {
			if (node.tagName !== 'blockquote') return;

			const firstP = node.children.find(
				(c): c is Element => c.type === 'element' && c.tagName === 'p'
			);
			if (!firstP) return;

			const firstText = firstP.children.find((c): c is Text => c.type === 'text');
			const m = firstText?.value.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
			if (!firstText || !m) return;

			const type = m[1].toLowerCase() as CalloutType;
			firstText.value = firstText.value.replace(/^\[!.*?\]\n?/, '');

			if (firstP.children.every((c): c is Text => c.type === 'text' && !c.value.trim())) {
				node.children = node.children.filter((c) => c !== firstP);
			}

			const titleClassNamesByType: Record<CalloutType, string> = {
				note: 'text-blue-600',
				tip: 'text-green-600',
				warning: 'text-yellow-600',
				important: 'text-red-600',
				caution: 'text-pink-600'
			};
			const titleNode: ElementContent = {
				type: 'element',
				tagName: 'p',
				properties: { className: [`font-bold`, titleClassNamesByType[type]] },
				children: [{ type: 'text', value: CALLOUT_LABELS[type] }]
			};

			node.tagName = 'div';
			const classNamesByType: Record<CalloutType, string> = {
				note: 'bg-blue-50 border-blue-600',
				tip: 'bg-green-50 border-green-600',
				warning: 'bg-yellow-50 border-yellow-600',
				important: 'bg-red-50 border-red-600',
				caution: 'bg-pink-50 border-pink-600'
			};
			node.properties = {
				className: [`border border-l-6 px-4`, classNamesByType[type]]
			};
			node.children.unshift(titleNode);
		});
	};
}

const docs = defineCollection({
	name: 'docs',
	directory: 'docs',
	include: '**/*.md',
	schema: v.object({
		title: v.string(),
		description: v.optional(v.string()),
		order: v.optional(v.number()),
		content: v.string()
	}),
	transform: async (doc, ctx) => {
		const html = await compileMarkdown(ctx, doc, {
			remarkPlugins: [remarkGfm],
			rehypePlugins: [rehypeSlug, rehypeCallouts]
		});
		const slug = doc._meta.path.replace(/\.md$/, '').replace(/^\/+/, '');
		const headings = [...html.matchAll(/<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g)].map(
			([, level, id, inner]) => ({
				level: Number(level),
				id,
				text: inner.replace(/<[^>]+>/g, '').trim()
			})
		);
		return { ...doc, html, slug: slug === 'index' ? '' : slug, headings };
	}
});

export default defineConfig({
	content: [docs]
});
