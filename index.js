const http = require('http');
const { Observable, Subject } = require('rxjs');
const debug = require('debug')('rx-server');
const uuid = require('uuid');

// - Create a req stream and a res stream.
// - The user only interacts with the res stream
// - Behind the scenes we zip the two stream so that we always have access to the
//   req and the res, allowing us to use all the standard instance methods
//   provided to http.Response
//
// - TODO: Update: Maybe zip isn't the best option, since I don't think it will
//   actually match up the responses to the requests after they've passed
//   through the epic. So, new approach: Assign each response a unique id and
//   create a dict mapping those ids to the response instances. Tag each request
//   instance with the associated response id and reassemble them later in
//   order to have access to the correct response instance. Once the response
//   instances has ended clear it out of memory.

const createApp = (epic) => {
  const reqSubject = new Subject();
  const responseMap = new Map();

  const responseObservable = epic(reqSubject);

  reqSubject
    .mergeMap(req => {
      debug('merge mapping')
      return responseObservable.map(x => Object.assign({}, x, { __resId: req.__resId })) // Tack on the res id
    })
    .subscribe(
      (response) => {
          debug('get subscribed result', response)
          const res = responseMap.get(response.__resId);
          responseMap.delete(response.__resId);

          res.writeHead(response.status, response.headers);
          res.write(response.body);
          res.end();
      },
      err => debug('FUCK', err),
      () => debug('DONE')
    );

  return (req, res) => {
    const resId = uuid();
    responseMap.set(resId, res);
    req.__resId = resId;
    debug(`Receiving ${req.method} ${req.url}`)
    reqSubject.next(req);
  };
}


const send = (body = '', options = {}) => {
  return {
    body,
    headers: options.headers,
    status: options.status,
  };
}

const epic = (req$) =>
  req$
    .do((req) => debug(`${req.method} ${req.url}`))
    .map(() => send('hey there', { status: 200, headers: {} }))


const server = http.createServer(createApp(epic));

server.listen(1111, () => {
  console.log('Listening at localhost:1111...');
});
