import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import MyApp from './_app';
import { GameBoard } from './game_board';
import { getAccount } from '@wagmi/core'
import { config } from '../wagmi'
import { useAccount } from 'wagmi';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/bundle";

const Home: NextPage = () => {
  const [fhevm, setFhevm] = useState<FhevmInstance | null>(null);
  useEffect(() => {
    (async () => {
      const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle')
      await initSDK();
      const fhe = await createInstance(SepoliaConfig);
      setFhevm(fhe);
    })();
  }, []);

  return (
    <div className={styles.container}>
      <Script src="https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs" type="text/javascript" strategy='beforeInteractive' />
      <Head>
        <title>Zama FHEVM Demo</title>
        <meta
          content="FHE Rock-Paper-Scissors, Powered by Zama FHEVM"
          name=""
        />
      </Head>

      <main className={styles.main}>
        <ConnectButton />

        <h1 className={styles.title}>
          🔐 FHE Rock-Paper-Scissors
        </h1>

        {useAccount({ config }).isConnected && fhevm != null && <GameBoard fhevm={fhevm} account={getAccount(config)} onGamePlayed={() => { }} />}

      </main>

      <footer className={styles.footer}>
        <p>
          Built with ❤️ Zama FHEVM<br />
          <a href="https://docs.fhevm.zama.ai/" target="_blank" rel="noopener noreferrer">
            Learn more about FHEVM
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Home;
