<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { max } from 'd3-array';
	import { line, curveLinear } from 'd3-shape';
	import { buildScoreProgressionSeries } from '$lib/utils/scoreProgression';

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
	let series = $derived(buildScoreProgressionSeries(points));

	const margin = { top: 8, right: 12, bottom: 20, left: 28 };
	let width = $state(0);
	let height = $state(0);

	let innerW = $derived(Math.max(0, width - margin.left - margin.right));
	let innerH = $derived(Math.max(0, height - margin.top - margin.bottom));

	let xScale = $derived(
		series
			? scaleLinear()
					.domain([0, series.a.length - 1])
					.range([0, innerW])
			: scaleLinear().range([0, innerW])
	);

	let yMax = $derived(series ? Math.max(5, max([...series.a, ...series.b], (d) => d.y) ?? 5) : 5);
	let yScale = $derived(scaleLinear().domain([0, yMax]).range([innerH, 0]).nice());

	let lineGen = $derived(
		line<{ x: number; y: number }>()
			.x((d) => xScale(d.x))
			.y((d) => yScale(d.y))
			.curve(curveLinear)
	);

	let pathA = $derived(series ? (lineGen(series.a) ?? '') : '');
	let pathB = $derived(series ? (lineGen(series.b) ?? '') : '');

	let yTicks = $derived(yScale.ticks(5));

	// Tooltip
	let tooltipIndex: number | null = $state(null);
	let tooltipX = $derived(tooltipIndex != null ? xScale(tooltipIndex) : null);

	function onMouseMove(e: MouseEvent) {
		if (!series) return;
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
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

	const tooltipLabel = {
		width: 64,
		height: 24,
		gap: 8
	};

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	let tooltipAnchorY = $derived(
		tooltipA != null && tooltipB != null
			? margin.top + Math.min(yScale(tooltipA), yScale(tooltipB))
			: null
	);

	let tooltipLabelX = $derived(
		tooltipCX != null
			? clamp(
					tooltipCX + tooltipLabel.gap + tooltipLabel.width <= width
						? tooltipCX + tooltipLabel.gap
						: tooltipCX - tooltipLabel.gap - tooltipLabel.width,
					0,
					Math.max(0, width - tooltipLabel.width)
				)
			: null
	);

	let tooltipLabelY = $derived(
		tooltipAnchorY != null
			? clamp(
					tooltipAnchorY - tooltipLabel.gap - tooltipLabel.height >= 0
						? tooltipAnchorY - tooltipLabel.gap - tooltipLabel.height
						: tooltipAnchorY + tooltipLabel.gap,
					0,
					Math.max(0, height - tooltipLabel.height)
				)
			: null
	);
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
				<svg {width} {height} role="img" onmousemove={onMouseMove} onmouseleave={onMouseLeave}>
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

						<!-- Score dots -->
						{#each series.a as p, i (`a-${i}-${p.x}-${p.y}`)}
							<circle
								cx={xScale(p.x)}
								cy={yScale(p.y)}
								r="2.5"
								class="fill-white stroke-pink-600"
								stroke-width="1.5"
								pointer-events="none"
							/>
						{/each}

						{#each series.b as p, i (`b-${i}-${p.x}-${p.y}`)}
							<circle
								cx={xScale(p.x)}
								cy={yScale(p.y)}
								r="2.5"
								class="fill-white stroke-cyan-600"
								stroke-width="1.5"
								pointer-events="none"
							/>
						{/each}

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

					<!-- Tooltip label -->
					{#if tooltipIndex != null && tooltipLabelX != null && tooltipLabelY != null && tooltipA != null && tooltipB != null}
						<rect
							x={tooltipLabelX}
							y={tooltipLabelY}
							width={tooltipLabel.width}
							height={tooltipLabel.height}
							rx="6"
							class="fill-white stroke-zinc-200"
							stroke-width="1"
						/>

						<text x={tooltipLabelX + 8} y={tooltipLabelY + 16} font-size="11" font-weight="600">
							<tspan class="fill-pink-600">{tooltipA}</tspan>
							<tspan class="fill-zinc-400" font-weight="400"> – </tspan>
							<tspan class="fill-cyan-600">{tooltipB}</tspan>
						</text>
					{/if}
				</svg>
			{/if}
		</div>
	</div>
{:else}
	<p class="py-6 text-center text-sm text-muted">まだラリーがありません</p>
{/if}
