import { allDocs } from 'content-collections';
import type { LayoutLoad } from './$types';

function category(path: string) {
	if (path.startsWith('admin')) return 'admin';
	if (path.startsWith('referee')) return 'referee';
	if (path.startsWith('team')) return 'team';
	if (path.startsWith('public')) return 'public';
	return 'intro';
}

function sortDocs(docs: typeof allDocs) {
	return [...docs].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export const load: LayoutLoad = () => {
	const all = allDocs
		.filter((d) => d.published !== false)
		.map((d) => ({ ...d, _cat: category(d._meta.path) }));

	const sections = [
		{ title: 'はじめに', docs: sortDocs(all.filter((d) => d._cat === 'intro')) },
		{ title: '管理者マニュアル', docs: sortDocs(all.filter((d) => d._cat === 'admin')) },
		{ title: '審判マニュアル', docs: sortDocs(all.filter((d) => d._cat === 'referee')) },
		{ title: '出場チームマニュアル', docs: sortDocs(all.filter((d) => d._cat === 'team')) },
		{ title: '観戦者向け', docs: sortDocs(all.filter((d) => d._cat === 'public')) }
	].filter((s) => s.docs.length > 0);

	return { sections };
};
