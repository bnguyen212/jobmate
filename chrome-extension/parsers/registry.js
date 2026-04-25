(function () {
	const registry = [];

	const register = parser => {
		if (!parser || !parser.domain) return;
		registry.push(parser);
	};

	const findByDomain = domain => registry.find(p => p.domain === domain) || null;

	const getSupportedDomains = () => registry.map(p => p.domain);

	window.JobMateParsers = {
		register,
		findByDomain,
		getSupportedDomains,
		list: () => registry.slice(),
	};
})();
