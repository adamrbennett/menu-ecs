const AWS = require('aws-sdk');
const request = require('request');
const express = require('express');
const app = express();
const ssm = new AWS.SSM({
  region: 'us-east-1'
});

const routesSSMKey = process.env.ROUTES_SSM_KEY || "sfi-api-dev-routes";
const port = process.env.APP_PORT || 3000;
const root = '/menu';

// load the configuration
let config = {};
loadConfig().then((c) => {
  config = c;
}, (err) => {
  console.log('Unable to load config');
  process.exit(1);
});

// health check endpoint also reloads the configuration
app.get('/', (req, res) => {
  loadConfig().then((c) => {
    config = c;
    return res.json(config);
  }, error(res)).catch(error(res));
});

// menu endpoint returns the menu
app.get(root, (req, res) => {
  let menu = [];

  // get brews
  get(config.routes.brews).then((brews) => {
    // save the brews response
    menu.push(JSON.parse(brews));

    // get roasts
    return get(config.routes.roasts);
  }, error(res)).then((roasts) => {
    // save the roasts response
    menu.push(JSON.parse(roasts));

    // return all permutations of brews and roasts
    return res.json(permutations(menu[0], menu[1]));
  }, error(res)).catch(error(res));
});

// listen for requests and signals
let server = app.listen(port);
process.on('SIGINT', () => {
  console.log('Shutting down');
  server.close();
  process.exit(0);
});

console.log(`Listening on port: ${port}`);

// loads the configuration values from SSM
function loadConfig() {
  let params = {
    Names: [routesSSMKey]
  };

  return new Promise((resolve, reject) => {
    return ssm.getParameters(params, (err, data) => {
      if (err) return reject(err);

      let config = {};
      config.routes = JSON.parse(data.Parameters.filter((param) => {
        return param.Name === routesSSMKey;
      })[0].Value);

      // config.routes.brews = data.Parameters.filter((param) => {
      //   return param.Name === 'brews-route';
      // })[0].Value;
      //
      // config.routes.roasts = data.Parameters.filter((param) => {
      //   return param.Name === 'roasts-route';
      // })[0].Value;

      return resolve(config);
    });
  });

}

// wraps a GET request in a promise
function get(url) {
  return new Promise((resolve, reject) => {
    return request(url, (err, res, body) => {
      if (err) return reject(err);
      return resolve(body);
    });
  });
}

// error handler helper
function error(res) {
  return (e) => {
    console.trace(e);
    return res.send(e);
  }
}

// return permutations across multiple arrays
function permutations() {
  var r = [], arg = arguments, max = arg.length-1;
  function helper(arr, i) {
    for (var j=0, l=arg[i].length; j<l; j++) {
      var a = arr.slice(0);
      a.push(arg[i][j]);
      if (i==max)
        r.push({
          brew: a[0],
          roast: a[1]
        });
      else
        helper(a, i+1);
    }
  }
  helper([], 0);
  return r;
}
