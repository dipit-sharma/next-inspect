This is a npm library to see server-side network calls on Next JS. 

How it starts - 
- Run command "npm run intercept"
- It starts a server on 8757 port, where you can see all the calls

How it works -
- When "npm run intercept" is run, a server at 8757 is started.
- This library uses axios-intercept to intercept all the axios network calls.
- All the intercepted calls are then sent to a web-socket server
- The port 8757 listens to that web-socket and renders the intercepted network call's data
- The posrt 8757 not only renders the received network calls but 
also make the new API calls from it's side so that those 
network calls are visible in the browser network tab as well
