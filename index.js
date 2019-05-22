'use strict';

module.exports = (builds, options = {}) => {
	const gulp = require('gulp');

	// package defaults
	const defaults = {
		createSubTasks: false,
		ignoreCommon: false,
		taskDelimiter: ' > ',
		WatchName: 'watch',
		watchSubTasks: false,
		watchTasks: false,
	};

	// these are not used by the package directly, but are common config options
	// that will get included as a set of defaults passed to the task callback.
	// if required, these can be overridden in the options param passed to this module.
	// otherwise, these will just be ignored if not used by the task.
	// lastly, you can disable these all together by setting options.ignoreCommon to true
	// more common config options may get added over time.
	const common = {
		ceol: {excludeNonMatches: true},
		debug: false,
		dep: false,
		depMin: false,
		dest: false,
		exclude: ['./**/*', '!./fonts/**/*', '!./node_modules/**/*', '!./vendor/**/*',],
		match: {sass: /[.]scss/, min: /(?<!\.min)\.(js|css)$/,},
		minify: false,
		post: [],
		pre: [],
		sass: {outputStyle: 'expanded',},
		size: {showFiles: true, showTotal: false, gzip: true},
		src: false,
		watch: false,
	};

	const refObj = {};
	const buildHierarchy = {};
	const taskCbs = {};

	const getSeries = taskName => {
		let {config, cb} = refObj[taskName];

		return gulp.series(...[...(config.pre || []), gulp.parallel(...cb), ...(config.post || [])])
	};

	const setWatcher = (taskName) => {
		let {config} = refObj[taskName];

		config.watch && gulp.task(taskName + defaults.taskDelimiter + 'watch', () => {
			gulp.watch(config.watch, {ignoreInitial: false}, getSeries(taskName));
		});
	};

	const setTask = (taskName) => {
		gulp.task(taskName, getSeries(taskName));
	};

	const setTasks = () => {
		Object.entries(buildHierarchy).forEach(([taskName, subTaskNames]) => {

			if (options.createSubTasks || options.watchSubTasks) {
				subTaskNames.forEach(subTaskName => {
					options.createSubTasks && setTask(subTaskName);
					options.watchSubTasks && setWatcher(subTaskName);
				});
			}

			setTask(taskName);
			options.watchTasks && setWatcher(taskName);
		});

		options.WatchName && gulp.task(options.WatchName, () => {
			Object.keys(buildHierarchy).forEach(taskName => {
				let {config} = refObj[taskName];
				config.watch && gulp.watch(config.watch, {ignoreInitial: false}, getSeries(taskName));
			})
		});
	};

	const populateChildBuilds = () => {

		Object.entries(builds).forEach(([name, build]) => {
			buildHierarchy[name] = [];

			if (typeof build.cb !== 'function') {
				let message = typeof build.cb === 'undefined' ? 'defined' : 'a function';
				build.cb = () => console.error(`***\`${name}\` callback is NOT ${message}!***`);
			}
			if (typeof build.configs === 'undefined') {
				console.error(`***\`${name}\` configs is NOT DEFINED!***`);
				return;
			} else if (!Array.isArray(build.configs)) {
				console.error(`***\`${name}\` configs is NOT an array!***`);
				return;
			}

			build.configs.forEach(configs => {
				configs = {...options, ...configs, ...{watch: (configs.watch === true ? configs.src : configs.watch)}};

				if (!Array.isArray(configs.id)) {
					configs.id = [configs.id];
					configs.src = [configs.src || defaults.src];
				}

				['pre', 'post', 'watch'].forEach(item => {
					if (!Array.isArray(configs[item])) {
						configs[item] = configs[item] ? [configs[item]] : defaults[item];
					}
				});

				configs.id.forEach((id, index) => {
					let callback;
					const config = {...configs, ...{id: configs.id[index], src: configs.src[index]}};

					config.name = config.name || config.id;
					config.filename = config.filename || `${config.id}.${name}`;

					config.displayName = (config.displayName || (name + config.taskDelimiter + config.name));
					callback = (cb) => build.cb({...{cb: refObj[config.displayName].cb[0], cbs: taskCbs,}, ...config,}, cb);
					callback.displayName = config.displayName;
					refObj[config.displayName] = {config, cb: [callback]};
					buildHierarchy[name].push(config.displayName);
					taskCbs[config.displayName] = callback;

					if (!!config.depMin || !!config.alsoMin) {
						let callbackMin;
						const configMin = {
							...config, ...{
								minify: true,
								name: config.name + config.taskDelimiter + 'min',
								displayName: config.displayName + config.taskDelimiter + 'min'
							}, ...(!!config.depMin ? {dep: config.depMin} : {})
						};

						configMin.displayName = (configMin.displayName || (name + configMin.taskDelimiter + configMin.name));
						callbackMin = (cb) => build.cb({...{cb: refObj[configMin.displayName].cb[0], cbs: taskCbs,}, ...configMin,}, cb);
						callbackMin.displayName = configMin.displayName;
						refObj[configMin.displayName] = {config: configMin, cb: [callbackMin]};
						buildHierarchy[name].push(configMin.displayName);
						taskCbs[configMin.displayName] = callback;
					}
				});
			});
		});

	};

	const populateParentBuilds = () => {

		Object.entries(builds).forEach(([name, build]) => {
			let config = {}, cb = [];

			build.configs.forEach(configs => {
				['pre', 'post', 'watch'].forEach(item => {
					if (item === 'watch' && configs.watch === true) {
						configs.watch = configs.src;
					}
					if (!Array.isArray(configs[item])) {
						configs[item] = configs[item] ? [configs[item]] : defaults[item];
					}
					config[item] = [...(config[item] || []), ...(configs[item] || [])];
				});
			});

			if (config.watch.length < 1) {
				config.watch = defaults.watch;
			}

			buildHierarchy[name].forEach(childName => {
				cb = [...cb, ...refObj[childName].cb];
			});

			refObj[name] = {config, cb};
		});

	};

	const populateCallbacksFromReferences = () => {

		Object.keys(refObj).forEach(name => {
			['pre', 'post'].forEach(action => {
				for (let index = refObj[name].config[action].length - 1; index >= 0; --index) {
					let id = refObj[name].config[action][index];
					if (refObj.hasOwnProperty(id) && refObj[id].hasOwnProperty('cb') && refObj[id].cb) {
						refObj[name].config[action].splice(index, 1, ...refObj[id].cb);
					}
				}
			});
		});

	};

	options.ignoreCommon || Object.assign(defaults, common);
	options = {...defaults, ...options};

	populateChildBuilds();
	populateParentBuilds();
	populateCallbacksFromReferences();
	setTasks();
};