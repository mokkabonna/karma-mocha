var formatError = function(error) {
  var stack = error.stack;
  var message = error.message;

  if (stack) {
    var firstLine = stack.substring(0, stack.indexOf('\n'));
    if (message && firstLine.indexOf(message) === -1) {
      stack = message + '\n' + stack;
    }

    // remove mocha stack entries
    return stack.replace(/\n.+\/mocha\/mocha.js\?\d*\:.+(?=(\n|$))/g, '');
  }

  return message;
};


var createMochaReporterNode = function() {
  var mochaRunnerNode = document.createElement('div');
  mochaRunnerNode.setAttribute('id', 'mocha');
  document.body.appendChild(mochaRunnerNode);
};

var haveMochaConfig = function(karma) {
  return karma.config && karma.config.mocha;
};

var createMochaReporterConstructor = function(tc, pathname) {
  // Set custom reporter on debug page
  if (/debug.html$/.test(pathname) && haveMochaConfig(tc) && tc.config.mocha.reporter) {
    createMochaReporterNode();
    return tc.config.mocha.reporter;
  }

  // TODO(vojta): error formatting
  return function(runner) {
    // runner events
    // - start
    // - end
    // - suite
    // - suite end
    // - test
    // - test end
    // - pass
    // - fail

    runner.on('start', function() {
      tc.info({total: runner.total});
    });

    runner.on('end', function() {
      tc.complete({
        coverage: window.__coverage__
      });
    });

    runner.on('test', function(test) {
      test.$errors = [];
    });

    runner.on('fail', function(test, error) {
      if ('hook' === test.type) {
        test.$errors = [formatError(error)];
        runner.emit('test end', test);
      } else {
        test.$errors.push(formatError(error));
      }
    });

    runner.on('test end', function(test) {
      var skipped = test.pending === true;

      var result = {
        id: '',
        description: test.title,
        suite: [],
        success: test.state === 'passed',
        skipped: skipped,
        time: skipped ? 0 : test.duration,
        log: test.$errors || []
      };

      var pointer = test.parent;
      while (!pointer.root) {
        result.suite.unshift(pointer.title);
        pointer = pointer.parent;
      }

      tc.result(result);
    });
  };
};


var createMochaStartFn = function(mocha) {
  return function(config) {
    var clientArguments;
    config = config || {};
    clientArguments = config.args;

    if (clientArguments) {
      if (Object.prototype.toString.call(clientArguments) === '[object Array]') {
        clientArguments.join(' ').replace(/--grep[\s|=]+(\S+)?\s*/, function(match, grep) {
          mocha.grep(grep);
          return match;
        });
      }

      /**
       * TODO(maksimrv): remove when karma-grunt plugin will pass
       * clientArguments how Array
       */
      if (clientArguments.grep) {
        mocha.grep(clientArguments.grep);
      }
    }

    mocha.run();
  };
};

// Default configuration
var mochaConfig = {
  reporter: createMochaReporterConstructor(window.__karma__, window.location.pathname),
  ui: 'bdd',
  globals: ['__cov*']
};

// Pass options from client.mocha to mocha
var createConfigObject = function(karma) {
  if (!karma.config || !karma.config.mocha) {
    return mochaConfig;
  }

  // Copy all properties to mochaConfig
  for (var key in karma.config.mocha) {

    // except for reporter
    if (key === 'reporter') {
      continue;
    }

    // and merge the globals if they exist.
    if (key === 'globals') {
      mochaConfig.globals = mochaConfig.globals.concat(karma.config.mocha[key]);
      continue;
    }

    mochaConfig[key] = karma.config.mocha[key];
  }
  return mochaConfig;
};

