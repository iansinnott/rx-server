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
  const resSubject = new Subject();
  const responseObservable = epic(reqSubject);

  Observable.zip(reqSubject, resSubject)
    // TODO: a mergeMap here could be used to add middleware
    .mergeMap(([req, res]) => {
      return responseObservable
        .map((response) => ({ response, _res: res }))
    })
    .subscribe(({ response, _res }) => {
      _res.writeHead(response.status, response.headers);
      _res.write(response.body);
      _res.end();
    })

  return (req, res) => {
    reqSubject.next(req);
    resSubject.next(res);
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
  req$.filter(req => req.methd === 'GET' && req.pathname === '/test')
    .map(req => send('Made it', { status: 200, headers: { 'Content-Type': 'text/html' }}));


http.createServer(createApp(epic));
