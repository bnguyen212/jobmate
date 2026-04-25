(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	const locationFromJsonLdJobLocation = (jl, utils) => {
		if (jl == null || jl === "") return "";
		if (typeof jl === "string") return utils.cleanText(jl);
		if (Array.isArray(jl)) {
			const parts = jl.map(item => locationFromJsonLdJobLocation(item, utils)).filter(Boolean);
			return parts.join("; ");
		}
		if (typeof jl === "object") {
			const addr = jl.address && typeof jl.address === "object" ? jl.address : null;
			if (addr) {
				const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].map(
					x => utils.cleanText(x),
				);
				const joined = parts.filter(Boolean).join(", ");
				if (joined) return joined;
			}
			const flat = [jl.addressLocality, jl.addressRegion, jl.addressCountry].map(x => utils.cleanText(x));
			const flatJoined = flat.filter(Boolean).join(", ");
			if (flatJoined) return flatJoined;
			if (jl.name) return utils.cleanText(jl.name);
			const addrOnly = jl.address || jl;
			if (addrOnly && typeof addrOnly === "object" && addrOnly !== jl) {
				return locationFromJsonLdJobLocation(addrOnly, utils);
			}
		}
		return "";
	};

	const jobPostingFromJsonLd = ($, utils) => {
		let title = "";
		let location = "";
		const visit = node => {
			if (!node || typeof node !== "object") return;
			const types = node["@type"];
			const typeStr = Array.isArray(types) ? types.join(" ") : String(types || "");
			if (/JobPosting/i.test(typeStr)) {
				if (node.title) title = utils.firstNonEmpty(title, utils.cleanText(node.title));
				location = utils.firstNonEmpty(
					location,
					locationFromJsonLdJobLocation(node.jobLocation, utils),
				);
				location = utils.firstNonEmpty(
					location,
					locationFromJsonLdJobLocation(node.employmentLocation, utils),
				);
			}
			if (node["@graph"]) node["@graph"].forEach(visit);
		};
		$('script[type="application/ld+json"]').each(function () {
			try {
				const data = JSON.parse($(this).text());
				if (Array.isArray(data)) data.forEach(visit);
				else visit(data);
			} catch (_e) {}
		});
		return { title, location };
	};

	const companyFromGreenhouseBoardUrl = (utils, rawUrl) => {
		if (!rawUrl) return "";
		try {
			const u = new URL(rawUrl);
			if (!/greenhouse\.io$/i.test(u.hostname.replace(/^www\./, ""))) return "";
			const segs = u.pathname.split("/").filter(Boolean);
			if (segs[0] === "embed") return "";
			if (segs.length >= 2 && segs[1] === "jobs")
				return utils.titleCaseWords(segs[0].replace(/-/g, " "));
		} catch (_e) {}
		return "";
	};

	const isGenericJobHeading = t => {
		const s = String(t || "")
			.replace(/\s+/g, " ")
			.replace(/\u00a0/g, " ")
			.trim();
		if (s.length < 2) return true;
		if (/^(careers?|job details)$/i.test(s)) return true;
		if (/^loading\b/i.test(s)) return true;
		return false;
	};

	/** Reject Greenhouse apply-form `.location` labels, React ids, and other non-geo noise. */
	const plausibleJobLocation = (utils, raw) => {
		const t = utils.cleanText(raw);
		if (!t) return "";
		if (t.length > 400) return "";
		if (/\(required\)/i.test(t)) return "";
		if (/\b[a-f0-9]{8,}\b/i.test(t)) return "";
		if (/^location$/i.test(t)) return "";
		if (/^select\s+/i.test(t)) return "";
		if (/^\s*location\s*\(/i.test(t)) return "";
		return t;
	};

	const companyFromCareerSiteMeta = ($, utils, pageUrl) => {
		const site = utils.cleanText($('meta[property="og:site_name"]').attr("content"));
		// "Datadog Careers | Datadog" / "Acme Jobs | Acme" — use the right-hand brand.
		if (site && /\|\s*\S/.test(site)) {
			const segs = site.split(/\s*\|\s*/).map(s => utils.cleanText(s)).filter(Boolean);
			const tail = segs[segs.length - 1];
			if (tail && !/^careers?$/i.test(tail)) return tail;
		}
		if (site && !/careers?/i.test(site)) return site;
		if (site) {
			const careersAt = site.match(/^careers\s+at\s+(.+)$/i);
			if (careersAt) return utils.cleanText(careersAt[1]);
		}
		try {
			const u = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
			const host = u.hostname.replace(/^www\./, "").replace(/\.(com|net|org|io|co|tech)$/i, "");
			if (host && !/^(localhost|\d)/i.test(host))
				return utils.titleCaseWords(host.replace(/[.-]+/g, " "));
		} catch (_e) {}
		return "";
	};

	const looksLikeLocationSegment = (utils, raw) => {
		const t = utils.cleanText(raw);
		if (!t) return false;
		if (/\b(united states|united kingdom|u\.s\.a\.?|canada|australia|india|remote|hybrid|on-?site|worldwide)\b/i.test(t))
			return true;
		if ((t.match(/,/g) || []).length >= 2) return true;
		if (/,/.test(t) && t.length >= 12 && /\b([A-Z][a-z]+,\s*){1,3}[A-Z]/.test(t)) return true;
		return false;
	};

	/** True for "City, State/Country" office lines — not team names like "Hardware Engineering". */
	const looksLikeGeographicOfficeLine = (utils, raw) => {
		const t = utils.cleanText(raw);
		if (!t) return false;
		if (looksLikeLocationSegment(utils, t)) return true;
		if (!/,/.test(t)) return false;
		const afterLast = t.split(",").pop().trim();
		if (/^[A-Z]{2}$/i.test(afterLast)) return true;
		if (
			/^(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)$/i.test(
				afterLast,
			)
		)
			return true;
		if (/\b(United Kingdom|Canada|Germany|France|Japan|China|India|Australia|Mexico|Brazil|Netherlands|Ireland|Spain|Italy|Poland|Sweden)\b/i.test(afterLast))
			return true;
		return false;
	};

	const pickJobMetaLocationFromSpans = ($meta, utils) => {
		const texts = $meta
			.find("span")
			.toArray()
			.map(el => utils.cleanText($(el).text()))
			.filter(Boolean);
		for (const t of texts) {
			if (plausibleJobLocation(utils, t) && looksLikeGeographicOfficeLine(utils, t)) return t;
		}
		for (const t of texts) {
			if (plausibleJobLocation(utils, t) && /,/.test(t) && t.length >= 6 && t.length < 200) return t;
		}
		return "";
	};

	const companyFromEmployerJobsPrefix = (utils, raw) => {
		let s = utils.cleanText(raw);
		s = s.replace(/\s+(jobs|careers|hiring|recruiting|job\s+board)\s*$/i, "");
		return utils.cleanText(s);
	};

	/** Last segment of "Role - Boston" style titles is an office hint, not the employer name. */
	const looksLikeTitleTrailingCityToken = (utils, raw) => {
		const t = utils.cleanText(raw);
		if (!t || /,/.test(t) || t.length > 28) return false;
		const lower = t.toLowerCase();
		const cities = new Set([
			"boston",
			"nyc",
			"sf",
			"chicago",
			"seattle",
			"austin",
			"denver",
			"atlanta",
			"london",
			"paris",
			"berlin",
			"tokyo",
			"dublin",
			"toronto",
			"montreal",
			"vancouver",
			"sydney",
			"singapore",
			"mumbai",
			"bengaluru",
			"shanghai",
			"remote",
			"hybrid",
			"emea",
			"apac",
			"americas",
		]);
		if (cities.has(lower)) return true;
		if (
			/^(new york|los angeles|san francisco|san jose|salt lake city|hong kong|las vegas|washington dc|washington d\.c\.)$/i.test(
				t,
			)
		)
			return true;
		if (!/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}$/.test(t)) return false;
		if (/^(sales|marketing|engineering|operations|platform|security|finance|legal|people|design|product|research|management|cloud|data)$/i.test(t))
			return false;
		return t.length <= 22;
	};

	const titleCompanyFromDashTitle = (utils, rawTitle) => {
		const parts = utils
			.cleanText(rawTitle)
			.split(/\s*-\s*/)
			.map(s => utils.cleanText(s))
			.filter(Boolean);
		if (parts.length < 2) return { jobTitle: "", company: "" };
		const first = parts[0];
		const last = parts[parts.length - 1];

		// Roku and similar: "Acme Jobs - Role Title - City, State, Country" — last segment is location, not company.
		if (parts.length >= 3 && looksLikeLocationSegment(utils, last)) {
			// Toast-style: "Territory Account Executive , SMB - Jacksonville, FL - Jacksonville, Florida, United States"
			// — first segment is the job title; middle and last are both geo, not "Employer - Role - Place".
			if (looksLikeLocationSegment(utils, parts[1])) {
				return { jobTitle: first, company: "" };
			}
			const jobTitle = parts.slice(1, -1).join(" - ");
			const company = companyFromEmployerJobsPrefix(utils, first);
			if (jobTitle && company) return { jobTitle, company };
		}
		if (parts.length === 2 && looksLikeLocationSegment(utils, last)) {
			return { jobTitle: first, company: "" };
		}
		// Datadog-style: "Customer Success Manager - Boston" — Boston is a site suffix, not company.
		if (parts.length === 2 && looksLikeTitleTrailingCityToken(utils, last) && first.length >= 8) {
			return { jobTitle: utils.cleanText(parts.join(" - ")), company: "" };
		}

		if (isGenericJobHeading(first) && /careers?/i.test(last)) return { jobTitle: "", company: "" };
		if (isGenericJobHeading(first)) return { jobTitle: "", company: "" };
		return { jobTitle: first, company: last };
	};

	const normalizeEmbeddedOgTitle = (utils, raw) => {
		let t = utils.cleanText(raw);
		if (!t) return "";
		t = t.replace(/^open\s+role\s*[—\-]\s*/i, "");
		t = t.replace(/\s*[|]\s*[^|]+$/, "");
		return utils.cleanText(t);
	};

	const embedParentPageFallbacks = ($, utils, evidenceUrl, pageUrl) => {
		const out = { jobTitle: "", company: "", jobLocation: "" };
		const og = normalizeEmbeddedOgTitle(
			utils,
			$('meta[property="og:title"]').attr("content"),
		);
		if (og) {
			const at = og.match(/^(.+?)\s+at\s+(.+)$/i);
			if (at) {
				out.jobTitle = utils.cleanText(at[1]);
				out.company = utils.cleanText(at[2]);
			} else {
				const dash = titleCompanyFromDashTitle(utils, og);
				if (dash.jobTitle) {
					out.jobTitle = dash.jobTitle;
					out.company = utils.firstNonEmpty(out.company, dash.company);
				} else {
					out.jobTitle = utils.firstNonEmpty(out.jobTitle, utils.parseTitleLocationFromTitle(og).title);
				}
			}
		}
		if (!out.jobTitle) {
			const $hx = $(
				"main h1, main h2, [role='main'] h1, [role='main'] h2, article h1, article h2, #main h1, #main h2",
			).filter(function () {
				return !isGenericJobHeading($(this).text());
			});
			out.jobTitle = utils.cleanText($hx.first().text());
		}
		if (!out.jobTitle) {
			const t = utils.cleanText(document.title);
			const at = t.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|–—-]|$)/i);
			if (at) {
				out.jobTitle = utils.cleanText(at[1]);
				out.company = utils.firstNonEmpty(out.company, utils.cleanText(at[2]));
			} else {
				const dash = titleCompanyFromDashTitle(utils, t);
				if (dash.jobTitle) {
					out.jobTitle = dash.jobTitle;
					out.company = utils.firstNonEmpty(out.company, dash.company);
				}
			}
		}
		if (!out.company) out.company = companyFromGreenhouseBoardUrl(utils, evidenceUrl);
		if (!out.company) out.company = companyFromCareerSiteMeta($, utils, pageUrl);
		if (!out.jobLocation && og) {
			const pl = utils.parseTitleLocationFromTitle(og);
			if (pl.location) out.jobLocation = plausibleJobLocation(utils, pl.location);
		}
		return out;
	};

	const parseGreenhouseDom = ($, utils) => {
		const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

		result.jobTitle =
			utils.cleanText($(".job-page-banner h1").first().text()) ||
			utils.cleanText($(".job__title h1").first().text()) ||
			utils.cleanText($(".job__header h1").first().text()) ||
			utils.cleanText($("#header .app-title").first().text()) ||
			utils.cleanText($(".app-title").first().text()) ||
			utils.cleanText($("#board_title").first().text()) ||
			utils.cleanText(
				$("main h1, [role='main'] h1, article h1, #main h1")
					.filter(function () {
						return !isGenericJobHeading($(this).text());
					})
					.first()
					.text(),
			) ||
			utils.cleanText(
				$("main h2, [role='main'] h2, article h2, #main h2")
					.filter(function () {
						return !isGenericJobHeading($(this).text());
					})
					.first()
					.text(),
			) ||
			// block.xyz / Svelte career sites: single page h1, no <main> wrapper around the job hero.
			utils.cleanText(
				$("h1")
					.filter(function () {
						return (
							!$(this).closest("header, footer, [data-testid='footer']").length &&
							!isGenericJobHeading($(this).text())
						);
					})
					.first()
					.text(),
			);

		const setJobLocation = v => {
			if (result.jobLocation) return;
			const p = plausibleJobLocation(utils, v);
			if (p) result.jobLocation = p;
		};

		// Block (block.xyz) and similar: Greenhouse embed + `[data-testid="job-location"]` / `is-remote-job` in `.job-info-container`.
		if (!result.jobLocation) {
			const $loc = $('[data-testid="job-location"]').first();
			if ($loc.length) {
				let place = utils.cleanText($loc.text());
				const $row = $loc.closest(".job-info-container");
				if ($row.length) {
					const $remote = $row.find('[data-testid="is-remote-job"]').first();
					if ($remote.length) {
						const remoteText = utils.cleanText($remote.text());
						if (remoteText && /^remote$/i.test(remoteText) && place && !/^remote\b/i.test(place)) {
							place = `${remoteText} ${place}`;
						}
					}
				}
				setJobLocation(place);
			}
		}

		// Toast (and similar): real posting lives in `.block-job-description`; `.job-location` also appears on
		// “recommended jobs” cards (`.jobs-list`) and must not win `.first()`.
		if (!result.jobLocation) {
			const $primaryListLoc = $(
				".block-job-description .job-component-list-location span, .job-component-details .job-component-location span",
			).first();
			if ($primaryListLoc.length) setJobLocation($primaryListLoc.text());
		}

		const locationOutsideGreenhouseForm = $ =>
			$("main .location, #main .location, [role='main'] .location, article .location")
				.filter(function () {
					return !$(this).closest("#grnhse_app").length;
				})
				.first();

		// Greenhouse native `.job__location`; many career sites (e.g. FanDuel WordPress) use `.job-location`.
		const $locationRow = $(".job__location, .job-location")
			.filter(function () {
				return (
					!$(this).closest("#grnhse_app").length &&
					!$(this).closest(".jobs-list, .block-jobs").length
				);
			})
			.first();
		if ($locationRow.length) {
			const $locationTextClone = $locationRow.clone();
			$locationTextClone.find("svg").remove();
			setJobLocation($locationTextClone.text());
		}
		// Aurora (Nuxt): `.job__meta` can list team first (e.g. Hardware Engineering) and office second (City, State).
		if (!result.jobLocation) {
			const $meta = $("section.job .job__meta, .job__content .job__meta, .job .job__meta").first();
			if ($meta.length) setJobLocation(pickJobMetaLocationFromSpans($meta, utils));
		}
		// Airbnb careers (WordPress): region under .job-page-banner .offices
		if (!result.jobLocation) {
			const $offices = $(".job-page-banner .offices").first();
			if ($offices.length) setJobLocation($offices.text());
		}
		// Ripple / Roku-style (Next.js): pin icon row — first direct span under flex row below main job h1.
		if (!result.jobLocation) {
			const $mainH1 = $("main h1").first();
			if ($mainH1.length) {
				const $flex = $mainH1.parent().children("div.flex").first();
				if ($flex.length) setJobLocation($flex.children("span").first().text());
			}
		}
		// Wiz.io (Next.js): immediate h2/h3 after main h1 — e.g. "Los Angeles, California | Field Sales"
		if (!result.jobLocation) {
			const $mainH1 = $("main h1").first();
			if ($mainH1.length) {
				const $sub = $mainH1.nextAll("h2, h3").first();
				if ($sub.length) {
					let t = utils.cleanText($sub.text());
					if (/\|/.test(t)) t = utils.cleanText(t.split("|")[0]);
					setJobLocation(t);
				}
			}
		}
		// Datadog / similar: primary h2 (no job h1), then a centered <p> with "City, State, Country"
		if (!result.jobLocation) {
			const $hero = $("main h2, [role='main'] h2, article h2, #main h2")
				.filter(function () {
					return !isGenericJobHeading($(this).text());
				})
				.first();
			if ($hero.length) {
				const $geo = $hero
					.nextAll("div")
					.first()
					.find("p.tw-text-center, p[class*='text-center']")
					.first();
				if ($geo.length) setJobLocation($geo.text());
			}
		}
		// Board `.location` only outside the embedded apply widget (`#grnhse_app`); bare `$(".location")` merges every form row.
		if (!result.jobLocation) setJobLocation(locationOutsideGreenhouseForm($).text());
		if (!result.jobLocation) {
			setJobLocation(
				$(".job-post .location, .job-details .location")
					.filter(function () {
						return !$(this).closest("#grnhse_app").length;
					})
					.first()
					.text(),
			);
		}

		const logoAlt =
			$(".logo img[alt]").attr("alt") ||
			$("img.logo[alt]").attr("alt") ||
			$(".image-container img[alt]").attr("alt");
		if (logoAlt) result.company = utils.cleanText(logoAlt.replace(/\s+logo\s*$/i, ""));

		const ld = jobPostingFromJsonLd($, utils);
		if (!result.jobTitle) result.jobTitle = ld.title;
		if (!result.jobLocation) setJobLocation(ld.location);

		if (!result.company) {
			const m =
				document.title.match(/\bat\s+(.+?)\s*(?:\||$)/i) || document.title.match(/ at (.+)$/i);
			if (m) result.company = utils.cleanText(m[1]);
		}
		if (!result.company) {
			const atIdx = document.title.lastIndexOf(" at ");
			if (atIdx !== -1) result.company = utils.cleanText(document.title.slice(atIdx + 4));
		}
		if (!result.company) {
			const legacy = utils.cleanText($(".company-name").text());
			if (legacy) {
				const parts = legacy.split(/\s+/);
				result.company = parts.length > 1 ? parts.slice(1).join(" ") : legacy;
			}
		}

		return result;
	};

	api.register({
		domain: "greenhouse.io",
		parseHost: context => {
			const utils = window.JobMateUtils;
			return parseGreenhouseDom(context.$, utils);
		},
		parseEmbedded: (context, evidenceUrl) => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const base = pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`;
			const merged = parseGreenhouseDom($, utils);
			const fb = embedParentPageFallbacks($, utils, evidenceUrl, pageUrl);
			const result = {
				jobTitle: utils.firstNonEmpty(merged.jobTitle, fb.jobTitle),
				company: utils.firstNonEmpty(merged.company, fb.company),
				jobLocation: utils.firstNonEmpty(
					plausibleJobLocation(utils, merged.jobLocation),
					plausibleJobLocation(utils, fb.jobLocation),
				),
				url: "",
			};
			result.url = utils.firstNonEmpty(
				utils.safeAbsUrl(utils.cleanText, evidenceUrl, base),
				utils.urlFromCanonicalOrOg($, utils.cleanText),
				pageUrl.startsWith("http") ? utils.cleanText(pageUrl) : "",
			);
			return result;
		},
	});
})();
