(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "wellfound.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };
			const toAbsoluteWellfoundUrl = rawUrl => {
				const cleaned = utils.cleanText(rawUrl);
				if (!cleaned) return "";
				if (/^https?:\/\//i.test(cleaned)) return cleaned;
				if (/^\/\//.test(cleaned)) return `https:${cleaned}`;
				if (cleaned.startsWith("/")) return `https://wellfound.com${cleaned}`;
				return `https://wellfound.com/${cleaned.replace(/^\/+/, "")}`;
			};
			const pickPreferredLocation = $root => {
				if (!$root || !$root.length) return "";
				const tokens = $root
					.find(".styles_locations__HHbZs .styles_location__O9Z62")
					.map(function () {
						return utils.cleanText($(this).text());
					})
					.get()
					.filter(Boolean)
					.filter(token => !/^more$/i.test(token));
				if (!tokens.length) return "";
				const isWorkModeToken = token =>
					/^(in office|on[\s-]?site(?: only)?|onsite or remote|remote only|hybrid)$/i.test(token);
				const geoTokens = tokens.filter(token => !isWorkModeToken(token));
				if (geoTokens.length) return geoTokens.join(", ");
				return tokens[0];
			};

			const $listing = $('[data-test="JobListing"], [data-testid="JobListing"]').first();
			if ($listing.length) {
				result.jobTitle = utils.cleanText($listing.find("h1").first().text());
				result.company = utils.cleanText(
					$listing
						.find(".flex.items-center")
						.first()
						.find('a[href*="/company/"] span.font-semibold')
						.first()
						.text() ||
						$listing.find('a[href*="/company/"] span.font-semibold').first().text() ||
						$listing.find('[data-testid="startup-header"] h3').first().text(),
				);
				result.jobLocation = utils.cleanText(
					$listing.find("h1").first().next("ul").find('a[href*="/location/"]').first().text() ||
						$listing.find('a[href*="/location/"]').first().text(),
				);
			}

			const wellfoundJobSlugFromUrl = () => {
				try {
					const url = new URL(
						pageUrl || (typeof location !== "undefined" ? location.href : ""),
						"https://wellfound.com",
					);
					return utils.cleanText(url.searchParams.get("job_listing_slug"));
				} catch (_) {
					return "";
				}
			};
			const wellfoundNumericId = value => {
				if (!value) return "";
				const m = String(value).match(/(\d{4,})/);
				return m ? m[1] : "";
			};
			const pickStartupResultJobLink = () => {
				const slug = wellfoundJobSlugFromUrl();
				const slugId = wellfoundNumericId(slug);
				const $allJobLinks = $('[data-test="StartupResult"] a[href*="/jobs/"]');
				if (!$allJobLinks.length) return $();
				if (slugId) {
					const $exact = $allJobLinks.filter(function () {
						const href = $(this).attr("href") || "";
						return href.includes(`/jobs/${slugId}`);
					});
					if ($exact.length) return $exact.first();
				}
				return $allJobLinks.first();
			};
			if (!result.jobTitle || !result.company || !result.jobLocation || !result.url) {
				const $jobLink = pickStartupResultJobLink();
				if ($jobLink.length) {
					const $card = $jobLink.closest('[data-test="StartupResult"]');
					if (!result.jobTitle) {
						result.jobTitle = utils.cleanText(
							$jobLink.find(".styles_title__xpQDw").first().text() || $jobLink.first().text(),
						);
					}
					if (!result.company) {
						result.company = utils.cleanText(
							$card.find('[data-testid="startup-header"] h2').first().text() ||
								$card.find('a[href*="/company/"] h2').first().text(),
						);
					}
					if (!result.jobLocation) {
						result.jobLocation = utils.cleanText(
							$jobLink.find(".styles_location__O9Z62").first().text() ||
								$card.find(".styles_location__O9Z62").first().text(),
						);
						const preferredLocation = pickPreferredLocation($jobLink);
						if (preferredLocation) result.jobLocation = preferredLocation;
					}
					if (!result.url) result.url = toAbsoluteWellfoundUrl($jobLink.attr("href"));
				}
			}

			const ogTitle = $('meta[property="og:title"]').attr("content");
			if (ogTitle) {
				const ogTitleNormalized = utils.cleanText(ogTitle);
				const ogBulletParts = ogTitleNormalized.split(/\s*•\s*/);
				if (ogBulletParts.length >= 2 && !result.jobLocation) {
					result.jobLocation = utils.cleanText(ogBulletParts[ogBulletParts.length - 1]);
				}
				const ogHeadlineForAtSplit = ogBulletParts[0] || ogTitleNormalized;
				const atMatch = ogHeadlineForAtSplit.match(/^(.+?)\s+at\s+(.+)$/i);
				if (atMatch) {
					if (!result.jobTitle) result.jobTitle = utils.cleanText(atMatch[1]);
					if (!result.company) result.company = utils.cleanText(atMatch[2]);
				}
			}

			if (!result.jobTitle) {
				const h1 = utils.cleanText($("h1").first().text());
				if (/^Search for jobs$/i.test(h1)) {
					// Ignore generic search heading on list pages.
				} else if (h1.includes(" at ")) {
					result.jobTitle = utils.cleanText(h1.split("at")[0]);
					result.company = utils.cleanText(h1.split("at").slice(1).join("at"));
				} else if (h1.includes(" from ")) {
					result.jobTitle = utils.cleanText(h1.split("from")[0]);
					result.company = utils.cleanText(h1.split("from").slice(1).join("from"));
				} else {
					result.jobTitle = h1;
				}
			}

			if (!result.company)
				result.company = utils.cleanText($('[data-testid="startup-header"] h3').first().text());

			if (!result.jobLocation) {
				const highConceptSummary = utils.cleanText($(".high-concept").text());
				if (highConceptSummary)
					result.jobLocation = utils.cleanText(highConceptSummary.split("·")[0]);
			}
			if (!result.jobLocation) {
				const preferredListingLocation = pickPreferredLocation(
					$('[data-test="StartupResult"]').first(),
				);
				if (preferredListingLocation) result.jobLocation = preferredListingLocation;
			}

			if (!result.url && pageUrl.includes("wellfound.com"))
				result.url = utils.urlFromCanonicalOrOg($, utils.cleanText);
			result.url = toAbsoluteWellfoundUrl(result.url);
			return result;
		},
	});
})();
