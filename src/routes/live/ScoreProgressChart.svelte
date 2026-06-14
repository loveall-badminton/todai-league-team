<script lang="ts">
	import * as d3 from 'd3';

	let {
		points,
		nameA,
		nameB
	}: {
		points: { gameNo: number; scoreA: number; scoreB: number }[];
		nameA: string;
		nameB: string;
	} = $props();

	// Only current (last) game's points, deduplicated and with a 0–0 origin prepended
	let series = $derived(
		(() => {
			if (points.length === 0) return null;
			const lastGame = points[points.length - 1].gameNo;
			const raw = points.filter((p) => p.gameNo === lastGame);
			// Drop consecutive entries where neither score changed
			const deduped = raw.filter(
				(p, i) => i === 0 || p.scoreA !== raw[i - 1].scoreA || p.scoreB !== raw[i - 1].scoreB
			);
			const withOrigin = [{ scoreA: 0, scoreB: 0 }, ...deduped];
			return {
				a: withOrigin.map((p, i) => ({ x: i, y: p.scoreA })),
				b: withOrigin.map((p, i) => ({ x: i, y: p.scoreB }))
			};
		})()
	);

	const margin = { top: 8, right: 12, bottom: 20, left: 28 };
	let svgEl: SVGSVGElement | undefined = $state();
	let width = $state(0);
	let height = $state(0);

	let innerW = $derived(Math.max(0, width - margin.left - margin.right));
	let innerH = $derived(Math.max(0, height - margin.top - margin.bottom));

	let xScale = $derived(
		series
			? d3
					.scaleLinear()
					.domain([0, series.a.length - 1])
					.range([0, innerW])
			: d3.scaleLinear().range([0, innerW])
	);

	let yMax = $derived(
		series ? Math.max(5, d3.max([...series.a, ...series.b], (d) => d.y) ?? 5) : 5
	);
	let yScale = $derived(d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice());

	let lineGen = $derived(
		d3
			.line<{ x: number; y: number }>()
			.x((d) => xScale(d.x))
			.y((d) => yScale(d.y))
			.curve(d3.curveStepAfter)
	);

	let pathA = $derived(series ? (lineGen(series.a) ?? '') : '');
	let pathB = $derived(series ? (lineGen(series.b) ?? '') : '');

	let yTicks = $derived(yScale.ticks(5));

	// Tooltip
	let tooltipIndex = $state<number | null>(null);
	let tooltipX = $derived(tooltipIndex != null ? xScale(tooltipIndex) : null);

	function onMouseMove(e: MouseEvent) {
		if (!series || !svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		const mx = e.clientX - rect.left - margin.left;
		const i = Math.round(xScale.invert(mx));
		tooltipIndex = Math.max(0, Math.min(series.a.length - 1, i));
	}

	function onMouseLeave() {
		tooltipIndex = null;
	}

	let tooltipA = $derived(tooltipIndex != null ? (series?.a[tooltipIndex]?.y ?? null) : null);
	let tooltipB = $derived(tooltipIndex != null ? (series?.b[tooltipIndex]?.y ?? null) : null);
	let tooltipCX = $derived(tooltipX != null ? tooltipX + margin.left : null);
</script>

{#if series}
	<div>
		<div class="mb-2 flex items-center gap-3">
			<span class="flex items-center gap-1 text-[10px] text-pink-700">
				<svg width="16" height="8"
					><line x1="0" y1="4" x2="16" y2="4" class="stroke-pink-600" stroke-width="2" /></svg
				>
				{nameA}
			</span>
			<span class="flex items-center gap-1 text-[10px] text-cyan-700">
				<svg width="16" height="8"
					><line x1="0" y1="4" x2="16" y2="4" class="stroke-cyan-600" stroke-width="2" /></svg
				>
				{nameB}
			</span>
		</div>
		<div class="h-40 w-full" bind:clientWidth={width} bind:clientHeight={height}>
			{#if width > 0 && height > 0}
				<svg
					bind:this={svgEl}
					{width}
					{height}
					role="img"
					onmousemove={onMouseMove}
					onmouseleave={onMouseLeave}
				>
					<g transform="translate({margin.left},{margin.top})">
						<!-- Y grid lines + ticks -->
						{#each yTicks as tick (tick)}
							<line
								x1={0}
								y1={yScale(tick)}
								x2={innerW}
								y2={yScale(tick)}
								class="stroke-zinc-200"
								stroke-width="1"
							/>
							<text
								x={-6}
								y={yScale(tick)}
								text-anchor="end"
								dominant-baseline="middle"
								font-size="9"
								class="fill-zinc-400">{tick}</text
							>
						{/each}

						<!-- X axis line -->
						<line
							x1={0}
							y1={innerH}
							x2={innerW}
							y2={innerH}
							class="stroke-zinc-200"
							stroke-width="1"
						/>

						<!-- Score lines -->
						<path
							d={pathA}
							fill="none"
							class="stroke-pink-600"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						<path
							d={pathB}
							fill="none"
							class="stroke-cyan-600"
							stroke-width="2"
							stroke-linejoin="round"
						/>

						<!-- Tooltip crosshair -->
						{#if tooltipIndex != null && tooltipX != null}
							<line
								x1={tooltipX}
								y1={0}
								x2={tooltipX}
								y2={innerH}
								class="stroke-zinc-400"
								stroke-width="1"
								stroke-dasharray="3 2"
							/>
							{#if tooltipA != null}
								<circle cx={tooltipX} cy={yScale(tooltipA)} r="3" class="fill-pink-600" />
							{/if}
							{#if tooltipB != null}
								<circle cx={tooltipX} cy={yScale(tooltipB)} r="3" class="fill-cyan-600" />
							{/if}
						{/if}
					</g>

					<!-- Tooltip label (rendered in SVG coordinates, outside transform) -->
					{#if tooltipIndex != null && tooltipCX != null && tooltipA != null && tooltipB != null}
						{@const labelX = Math.min(tooltipCX + 6, width - 62)}
						<rect
							x={labelX}
							y={8}
							width={56}
							height={22}
							rx="4"
							class="fill-white stroke-zinc-200"
							stroke-width="1"
						/>
						<text x={labelX + 6} y={23} font-size="11" font-weight="600">
							<tspan class="fill-pink-600">{tooltipA}</tspan><tspan
								class="fill-zinc-400"
								font-weight="400"
							>
								–
							</tspan><tspan class="fill-cyan-600">{tooltipB}</tspan>
						</text>
					{/if}
				</svg>
			{/if}
		</div>
	</div>
{:else}
	<p class="py-6 text-center text-sm text-zinc-400">まだラリーがありません</p>
{/if}
