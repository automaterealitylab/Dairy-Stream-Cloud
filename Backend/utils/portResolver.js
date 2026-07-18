import net from "node:net";

export const getAvailablePort = async (preferredPort, host = "0.0.0.0") => {
  const candidatePort = Number(preferredPort) || 4000;

  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(getAvailablePort(candidatePort + 1, host));
        return;
      }

      reject(error);
    });

    server.listen(candidatePort, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : candidatePort;

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
};
