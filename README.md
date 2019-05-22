# gulp-create-tasks

Gulp Plugin that automatically creates gulp 4+ tasks and watchers.

# about gulp-create-tasks

The motivation behind writing this package is that I noticed I was constantly copying and pasting taskNames 
and globs throughout my gulpFile.js. I'd have tasks for JS tasks for minified (prod) and unminified (dev) that 
were nearly the same, but with third party dependencies that were slightly different. Or CSS tasks for front-end
and back-end that may only have one or two differences. Then when creating tasks and/or watchers, I might have
to change one thing and copy and paste it three or four times in my gulpFile.js. Possibly making a mistake or forgetting
to make a change in one spot. This also made the gulpFile.js harder to read and bloated. I could create variables
or functions to handle the changes, but that made the gulpFile.js even more unwieldy. So I came up with a format
that allows for succinct rules that will create my tasks and watchers for me.

The concept is straightforward. You pass require('gulp-create-tasks') two options: a `builds` object and an optional
`options` object:

The `builds` object is a collection of tasks and their corresponding callbacks. The `builds` 
object is a list of key-values pairs. The key is the name of the tasks grouping that all share the same callback. 
The value is an object with a `configs` key and a `cb` (callback) key. The `configs` object is an array of tasks 
whose information will get passed to the `cb` callback. The contents of this object is arbitrary, it is solely
dependant on what you want to pass to the callback. Typically you might want to pass values for at least 
`src` and `dest`, but it's completely optional. You could just as easily hard code everything in the `cb` callback,
making the contents of the `configs` array unnecessary. I would not recommend that, but hey It's your code!
Also, having an `id` is nice because it displays that name in the console output, but if left empty it will still work,
it just displays `undefined`. There is also some syntactic sugar which I will discuss below.

The `options` object is simply global options that get merged into every local `configs` options that is sent to
the `cb` callback. For example, you may have the same browerlist or babelrc options for multiple tasks. So you set
it once in the `options` and you don't need to copy and paste in each individual task `configs`. However, you can 
override these directly in the `configs` option if you need to. Finally, there are a few package rules that you
can also pass in the `options`, if needed, which I'll discuss below. 


# Usage

```node
createTasks = require('gulp-create-tasks')
```

```node
const gulp = require('gulp'),
	createTasks = require('gulp-create-tasks'),
	browsers = ["last 1 version", "> 1%", "maintained node versions", "not dead"];

const options = {
	browsers,
	match: {sass: /[.]scss/, min: /(?<!\.min)\.(js|css)$/},
	postcss: [cssnano({preset: 'default'})],
	babelrc: {
		presets: [
			["@babel/preset-env", {targets: {browsers}}],
			["@babel/preset-react", {targets: {browsers}}],
		],
	},
};

const builds = {
	css: {
		configs: [{
			id: ['styles', 'editor'],
			src: [['./scss/styles.scss'], ['./scss/editor.scss']],
			dep: ['./node_modules/owl.carousel/dist/assets/owl.carousel.css'],
			dest: './css',
			watch: ['./scss/**/*.scss'],
			post: ['clean'],
		}],
		cb(_, cb) {
			return gulp.src(_.src)
				.pipe(gulpif(_.dep, addsrc.prepend(_.dep)))
				.pipe(gulpif(_.match.sass, gulpif(_.sass, sass(_.sass).on('error', sass.logError))))
				.pipe(concat(_.filename))
				.pipe(gulp.dest(_.dest))
				.pipe(gulpif(!!_.postcss, postcss(_.postcss)))
				.pipe(rename({suffix: '.min'}))
				.pipe(gulp.dest(_.dest));
		},
	},
	js: {
		configs: [{
			id: 'scripts',
			src: './js/src/**/*.js',
			dep: ['./node_modules/owl.carousel/dist/owl.carousel.js'],
			depMin: ['./node_modules/owl.carousel/dist/owl.carousel.min.js'],
			dest: './js/dist',
			watch: true,
			post: ['clean'],
		}],
		cb(_, cb) {
			return gulp.src(_.src)
				.pipe(concat(_.filename))
				.pipe(gulpif(_.babelrc, babel(_.babelrc)))
				.pipe(gulpif(_.dep, addsrc.prepend(_.dep)))
				.pipe(gulpif(_.minify, gulpif(_.match.min, uglify())))
				.pipe(concat(_.filename))
				.pipe(gulpif(_.minify, rename({suffix: '.min'})))
				.pipe(gulp.dest(_.dest));
		}
	},
	clean: {
		configs: [{
			id: 'all',
			debug: {title: 'clean:all'},
		}],
		cb(_, cb) {
			return gulp.src(_.exclude, {base: (_.base || './'), since: gulp.lastRun(_.cb)})
				.pipe(gulpif(_.ceol, ceol(_.ceol)))
				.pipe(gulp.dest((_.dest || './')));
		},
	},
};

createTasks(builds, options);
```

# Package config options

* `ignoreCommon: false` - if you don't want to include the `common` options defined in the package, set this to `true`
* `taskDelimiter: ' > '` - The console output will combine the build key and the task id with this delimiter for readability. You can also use the same format to reference specific tasks in the `pre` and `post` fields. See below.
* `WatchName: 'watch'` - The name to give the `watch` task for watching all the `watch` fields defined
* `watchTasks: false` - Add watchers to each `build` key
* `createSubTasks: false` - Add tasks for ALL tasks rather than simply `build` grouping
* `watchSubTasks: false` - Watch ALL tasks, rather than just the `build` grouping

# Other Notes and Syntactic Sugar

* `cb` receive two arguments, the first is the options object, the second is the gulp `cb` callback. See https://gulpjs.com/docs/en/api/task for more info on the cb callback in gulp
* in addition to the the current options, the options object also returns a `cb` field for the current callback, and a `cbs` field for all task callbacks in an object. This can be useful when calling gulp.lastRun() 
* I used `_` as the variable name because I think it's easier to read, but if this is confusing, you can replace `_` with the variable name `options`
* if `id` is an array, then `src` must be indexed the same way. See css build object above. Basically this means you have two tasks that are identical in every way except in the `src` field. So rather then repeating code, you can make `id` and `src` matching indexed arrays. This is a shorthand usage. You can achieve the same thing with two `configs` and copying and pasting the common fields between them.
* `depMin` is similar but for file/glob dependencies. In the example above I wanted to use owl carousel's compressed version for production, but uncompressed for dev. With `depMin` defined, the task will automatically run twice. One with the original `dep`, then one with `depMin` replacing `dep`. It also creates a `minify` field set to true the second time around, which you can use with a gulpif in your pipes. 
* If you don't have a need for splitting dependency files (min and non-min), but you still want to run the task twice, 1st with minify false, then with minify true, use `alsoMin` instead of `depMin`.
* if `filename` is not set (in the local options), then by default the `configs` id and the `build` key will be joined with a period to create the filename. In the example above: `css` filenames would be `styles.css` and `editor.css`,  and `js` filename would be `scripts.js` (and `scripts.min.js` for `depMin` callback)
* `pre` and `post` fields are used as pre and post gulp.series callbacks. For example, as shown above, if you want to run all the `clean` tasks after the current task, then referencing it by name in the `post` field will run those. You do the same for `pre` (if needed). You can also isolate a specific task like this {..., post: ['clear > all'], ...}. This will only run the `all` task under `clean`.
* if defined, the `watch` field signals which files to watch for the automated watcher. If left blank or `false`, no watcher is set. If set to `true`, then it will use the `src` field as the `watch` files