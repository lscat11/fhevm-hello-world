"use client";
import { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../config';
import { ethers } from 'ethers';
import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useAccount, useSignTypedData, UseAccountReturnType } from 'wagmi';
import type { Address } from 'viem';
import { config } from '../wagmi'
import { GetAccountReturnType, waitForTransactionReceipt as waitForTransactionReceiptWagmi } from "wagmi/actions";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstanceConfig } from "@zama-fhe/relayer-sdk/web";
import { initSDK, SepoliaConfig, type HandleContractPair } from "@zama-fhe/relayer-sdk/bundle";
import type { DecryptedResults } from "@zama-fhe/relayer-sdk/bundle";
import { getAccount, getBlockNumber } from 'wagmi/actions';
import { AccountNotFoundError } from 'viem/_types/errors/account';
import { FHERPS_ABI } from './abi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';

export const waitForTransactionReceipt = async (hash: `0x${string}`) => {
  const receipt = await waitForTransactionReceiptWagmi(config, { hash });
  return {
    receipt,
    isConfirmed: receipt.status === "success",
  };
};

export function useTopWinnerStatsFn() {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
    abi: FHERPS_ABI,
    functionName: 'getTopWinnerStats',
    args: [],
    query: {
      enabled: false,
    },
  });

  return refetch;
}

export function useUserStatsFn(user: `0x${string}`) {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
    abi: FHERPS_ABI,
    functionName: 'getWinLossTieStats',
    args: [user],
    query: {
      enabled: false,
    },
  });

  return refetch;
}

export const usePlay = () => {

  const [isConfirmed, setIsConfirmed] = useState(false);
  const {
    data: hash,
    isPending,
    error: excuteError,
    isError: isExcuteError,
    writeContractAsync,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    error: callError,
    isError: isCallError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const writeContract = async (fhevm: FhevmInstance, address: Address, move: number) => {
    setIsConfirmed(false);

    const encryptedMove = await
      fhevm.createEncryptedInput(CONFIG.CONTRACT_ADDRESS, address)
        .add8(move)
        .encrypt();

    const toHex = (uint8Array: Uint8Array): `0x${string}` => {
      return ('0x' + Array.from(uint8Array)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')) as `0x${string}`;
    };


    const hash = await writeContractAsync({
      address: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
      abi: FHERPS_ABI,
      functionName: "play",
      args: [toHex(encryptedMove.handles[0]), toHex(encryptedMove.inputProof)],
    });

    const { receipt, isConfirmed } = await waitForTransactionReceipt(hash);
    setIsConfirmed(isConfirmed);
    return {
      receipt,
      isConfirmed,
    };
  };

  const error = callError || excuteError;
  return {
    isConfirmed,
    writeContract,
    isPending: isConfirming || isPending,
    hash,
    errorMessage:
      error?.message || "Unknown error",
    isError: isCallError || isExcuteError,
  };
};

export const useRequestTopWinDecryption = () => {

  const [isConfirmed, setIsConfirmed] = useState(false);
  const {
    data: hash,
    isPending,
    error: excuteError,
    isError: isExcuteError,
    writeContractAsync,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    error: callError,
    isError: isCallError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const writeContract = async (fhevm: FhevmInstance) => {
    setIsConfirmed(false);


    const contract = CONFIG.CONTRACT_ADDRESS as `0x${string}`;

    const hash = await writeContractAsync({
      address: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
      abi: FHERPS_ABI,
      functionName: "decryptTopWinner",
      args: [],
    });
    console.log(`hash is ${hash}`);

    const { receipt, isConfirmed } = await waitForTransactionReceipt(hash);
    setIsConfirmed(isConfirmed);
    return {
      receipt,
      isConfirmed,
    };
  };

  const error = callError || excuteError;
  return {
    isConfirmed,
    writeContract,
    isPending: isConfirming || isPending,
    hash,
    errorMessage:
      error?.message || "Unknown error",
    isError: isCallError || isExcuteError,
  };
};


export const useGame = (fhevm: FhevmInstance, account: GetAccountReturnType<typeof config>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refetchTopWinnerStats = useTopWinnerStatsFn();
  const refetchUserStats = useUserStatsFn(account?.address as `0x${string}`);
  const [keypair, setKeyPair] = useState<any | null>(fhevm?.generateKeypair());
  const { signTypedDataAsync } = useSignTypedData();

  const { writeContract: playContract } = usePlay();
  const { writeContract: decTopWinContract } = useRequestTopWinDecryption();

  const playMove = useCallback(async (move: number) => {
    setIsLoading(true);
    setError(null);

    try {
      await playContract(fhevm, account.address as `0x${string}`, move)
      return { success: true };
    } catch (err) {
      console.error('Error playing move:', err);
      setError(err instanceof Error ? err.message : 'Failed to play move');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsLoading(false);
    }
  }, [account, playContract, fhevm]);

  const getUserStats = useCallback(async () => {

    setIsLoading(true);
    setError(null);

    try {

      const user_stats = await refetchUserStats();

      if (!user_stats.data) {
        throw new Error('User stats data is undefined');
      }

      const win_handle = user_stats.data[0];
      const loss_handle = user_stats.data[1];
      const tie_handle = user_stats.data[2];

      if (win_handle == ethers.ZeroHash.toString()) {
        return {
          wins: 0,
          losses: 0,
          ties: 0,
        };
      }

      const start_time_stamp = Math.floor(Date.now() / 1000).toString();
      const duration_days = "1";

      const eip712 = fhevm.createEIP712(
        keypair.publicKey,
        [CONFIG.CONTRACT_ADDRESS],
        start_time_stamp,
        duration_days
      );

      // console.log(`domain ${JSON.stringify(eip712.domain)}, message ${JSON.stringify(eip712.message)}, ${JSON.stringify(eip712.types.UserDecryptRequestVerification)}`);
      console.log(`domain ${JSON.stringify(eip712.domain)}`);
      console.log(`message ${JSON.stringify(eip712.message)}`);
      console.log(`types ${JSON.stringify(eip712.types.UserDecryptRequestVerification)}`);


      const dec_types = {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification
      };

      const signature = await signTypedDataAsync(
        {
          domain: {
            ...eip712.domain,
            verifyingContract: eip712.domain.verifyingContract as `0x${string}`,
          },
          types: dec_types,
          message: eip712.message,
          primaryType: 'UserDecryptRequestVerification',
          account: account.address as `0x${string}`,
        }
      );
      console.log(`signature : ${signature}`);

      const handle_pairs = [
        {
          handle: win_handle,
          contractAddress: CONFIG.CONTRACT_ADDRESS
        },
        {
          handle: loss_handle,
          contractAddress: CONFIG.CONTRACT_ADDRESS
        },
        {
          handle: tie_handle,
          contractAddress: CONFIG.CONTRACT_ADDRESS
        },
      ];

      const result = await fhevm.userDecrypt(
        handle_pairs,
        keypair.privateKey,
        keypair.publicKey,
        signature,
        [CONFIG.CONTRACT_ADDRESS],
        account.address as `0x${string}`,
        start_time_stamp,
        duration_days
      );

      console.log(`result : ${result[win_handle]}, ${result[loss_handle]}, ${result[tie_handle]}`);

      return {
        wins: result[win_handle],
        losses: result[loss_handle],
        ties: result[tie_handle],
      };
    } catch (err) {
      console.error('Error getting user stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to get stats');
      return { wins: 0, losses: 0, ties: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [account, keypair, fhevm, refetchUserStats, signTypedDataAsync]);

  const getTopWinner = useCallback(async () => {

    setIsLoading(true);
    setError(null);

    try {
      const result = await refetchTopWinnerStats();
      const cur_block = await getBlockNumber(config);

      if (!result.data) {
        throw new Error('Top winner stats data is undefined');
      }
      const [top_win_addr, top_win_amount, top_win_is_decrypting, top_win_decrypt_block] = result.data;

      return {
        address: top_win_addr,
        wins: top_win_amount,
        dec_block: top_win_decrypt_block,
        cur_block: Number(cur_block),
      };
    } catch (err) {
      console.error('Error getting top winner:', err);
      setError(err instanceof Error ? err.message : 'Failed to get top winner');
      return { address: null, wins: 0, dec_block: 0, cur_block: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [refetchTopWinnerStats]);

  const requestDecryption = useCallback(async () => {

    setIsLoading(true);
    setError(null);

    try {
      var flag = false;
      var old_dec_block = 0;

      while (true) {
        const old_result = await refetchTopWinnerStats();
        if (!old_result.data) {
          throw new Error('Top winner stats data is undefined');
        }
        const [old_top_win_addr, old_top_win_amount, old_top_win_is_decrypting, old_top_win_decrypt_block] = old_result.data;
        old_dec_block = Number(old_top_win_decrypt_block);
        if (old_top_win_is_decrypting) {
          console.log(`winner ${old_top_win_addr}, ${old_top_win_amount}, ${old_top_win_is_decrypting}, ${old_top_win_decrypt_block}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          flag = true;
        } else {
          break;
        }
      }

      if (!flag) {
        await decTopWinContract(fhevm);
        while (true) {
          const new_result = await refetchTopWinnerStats();
          if (!new_result.data) {
            throw new Error('Top winner stats data is undefined');
          }
          const [new_top_win_addr, new_top_win_amount, new_top_win_is_decrypting, new_top_win_decrypt_block] = new_result.data;
          const new_dec_block = Number(new_top_win_decrypt_block);
          if (new_dec_block > old_dec_block) {
            break;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      return { success: true, error: null };
    } catch (err) {
      console.error('Error requesting decryption:', err);
      setError(err instanceof Error ? err.message : 'Failed to request decryption');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      setIsLoading(false);
    }
  }, [decTopWinContract, refetchTopWinnerStats, fhevm]);

  return {
    isLoading,
    error,
    playMove,
    getUserStats,
    getTopWinner,
    requestDecryption,
  };
};