import path from 'path';

import chalk from 'chalk';
import NodeEnvironment from 'jest-environment-node';

import { VerdaccioConfig } from '../../lib/verdaccio-server';
import VerdaccioProcess from '../../lib/server_process';
import Server from '../../lib/server';
import { IServerBridge } from '../../types';
import { PORT_GITLAB_EXPRESS_MOCK, DOMAIN_SERVERS, PORT_SERVER_1 } from '../config.functional';

import GitlabServer from './mock_gitlab_server';

class FunctionalEnvironment extends NodeEnvironment {
  config: any;

  constructor(config: any) {
    super(config);
  }

  async startWeb() {
    const gitlab: any = new GitlabServer();

    return await gitlab.start(PORT_GITLAB_EXPRESS_MOCK);
  }

  async setup() {
    const SILENCE_LOG = !process.env.VERDACCIO_DEBUG;
    // @ts-ignore
    const DEBUG_INJECT: boolean = process.env.VERDACCIO_DEBUG_INJECT ? process.env.VERDACCIO_DEBUG_INJECT : false;
    const forkList = [];
    const serverList = [];
    const pathStore = path.join(__dirname, '../store');
    const listServers = [
      {
        port: PORT_SERVER_1,
        config: '/config-1.yaml',
        storage: '/test-storage1',
      },
    ];
    console.log(chalk.green('Setup Verdaccio Servers'));

    const app = await this.startWeb();
    this.global.__GITLAB_SERVER__ = app;

    for (const config of listServers) {
      const verdaccioConfig = new VerdaccioConfig(
        path.join(pathStore, config.storage),
        path.join(pathStore, config.config),
        `http://${DOMAIN_SERVERS}:${config.port}/`,
        config.port
      );
      console.log(chalk.magentaBright(`Running registry ${config.config} on port ${config.port}`));
      const server: IServerBridge = new Server(verdaccioConfig.domainPath);
      serverList.push(server);
      const process = new VerdaccioProcess(verdaccioConfig, server, SILENCE_LOG, DEBUG_INJECT);

      const fork = await process.init();
      console.log(chalk.blue(`Fork PID ${fork[1]}`));
      forkList.push(fork);
    }

    this.global.__SERVERS_PROCESS__ = forkList;
    this.global.__SERVERS__ = serverList;
  }

  async teardown() {
    await super.teardown();
    console.log(chalk.yellow('Teardown Test Environment.'));
    // shutdown verdaccio
    for (const server of this.global.__SERVERS_PROCESS__) {
      server[0].stop();
    }
    // close web server
    this.global.__GITLAB_SERVER__.server.close();
  }

  runScript(script: string) {
    return super.runScript(script);
  }
}

module.exports = FunctionalEnvironment;
