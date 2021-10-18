import { assign, createMachine } from 'xstate';
import { Contract, ethers } from 'ethers';
import abi from './utils/WavePortal.json';

declare global {
  interface Window {
    ethereum: any;
  }
}

const contractAddress = '0x0C3EB93A6C370b2B9F6C1095433ff4C6857fe691';
const contractABI = abi.abi;

export const wavePortalMachine = createMachine(
  {
    id: 'wave-portal',
    initial: 'checkingIfWalletIsConnected',
    context: {
      error: null as string | null,
      message: '',
      account: null as string | null,
      contract: null as Contract | null,
    },
    states: {
      checkingIfWalletIsConnected: {
        invoke: {
          src: 'checkForWallet',
          onDone: {
            target: 'idle',
            actions: ['setAccount', 'setContract'],
          },
          onError: 'waitingForWallet',
        },
      },
      waitingForWallet: {
        on: {
          CONNECT_WALLET: 'connectingWallet',
        },
        exit: ['clearError'],
      },
      connectingWallet: {
        invoke: {
          src: 'connectWallet',
          onDone: {
            target: 'idle',
            actions: ['setAccount', 'setContract'],
          },
          onError: {
            target: 'waitingForWallet',
            actions: 'setError',
          },
        },
      },
      idle: {
        on: {
          UPDATE_MESSAGE: { actions: 'updateMessage' },
          CLEAR_MESSAGE: { actions: 'clearMessage' },
        },
      },
    },
  },
  {
    actions: {
      updateMessage: assign((_, event) => ({
        message: (event as any).value,
      })),
      clearError: assign((_) => ({
        error: null,
      })),
      setError: assign((_, event) => ({
        error: (event as any).data,
      })),
      setAccount: assign((_, event) => ({
        account: (event as any).data,
      })),
      setContract: assign((_) => {
        const { ethereum } = window;
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const wavePortalContract = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );

        return { contract: wavePortalContract };
      }),
      clearMessage: assign((_) => ({
        message: '',
      })),
    },
    services: {
      checkForWallet: () =>
        new Promise(async (resolve, reject) => {
          try {
            const { ethereum } = window;

            if (!ethereum) {
              reject('Metamask has to be installed!');
            }

            const accounts = await ethereum.request({ method: 'eth_accounts' });

            if (accounts.length !== 0) {
              const account = accounts[0];
              resolve(account);
            } else {
              reject();
            }
          } catch (error) {
            reject(
              'An unknown error has occurred while checking if a wallet is already connected.'
            );
          }
        }),
      connectWallet: () =>
        new Promise(async (resolve, reject) => {
          try {
            // we already checked if the ethereum object is present in a previous state
            const { ethereum } = window;

            const accounts = await ethereum.request({
              method: 'eth_requestAccounts',
            });

            resolve(accounts[0]);
          } catch (error) {
            reject(`Could not connect to wallet: ${(error as any)?.message}`);
          }
        }),
    },
  }
);
