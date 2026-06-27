import { error } from '@sveltejs/kit';
import { allDocs } from 'content-collections';
import type { PageLoad, EntryGenerator } from './$types';

export const load: PageLoad = ({ params }) => {
	const slug = params.slug || '';
	const doc = allDocs.find((d) => d.slug === slug);
	if (!doc || doc.published === false) {
		error(404, `ページが見つかりません: ${slug}`);
	}
	return { doc };
};

export const entries: EntryGenerator = () => {
	return allDocs.filter((d) => d.published !== false).map((d) => ({ slug: d.slug }));
};
