import { error } from '@sveltejs/kit';
import { allDocs } from 'content-collections';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const slug = params.slug || '';
	const doc = allDocs.find((d) => d.slug === slug);
	if (!doc) {
		error(404, `ページが見つかりません: ${slug}`);
	}
	return { doc };
};
