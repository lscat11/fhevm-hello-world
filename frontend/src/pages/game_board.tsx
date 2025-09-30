"use client";
import React, { useState } from 'react';
// import { useGame } from '../hooks/useGame';
import { CONFIG } from '../config';
import { useGame } from '../hooks/use_game';
import { getAccount } from '@wagmi/core'
import { config } from '../wagmi'
import { useReadContract } from 'wagmi';
import { useEffect } from 'react';
import { FhevmInstance } from '@zama-fhe/relayer-sdk/bundle';

interface GameBoardProps {
  fhevm: any;
  account: any;
  onGamePlayed: () => void;
}


export const GameBoard: React.FC<GameBoardProps> = ({ fhevm, account, onGamePlayed }) => {
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [gameMessage, setGameMessage] = useState<string>('');
  const [userStats, setUserStats] = useState<{ wins: number; losses: number; ties: number } | null>(null);
  const [topWinner, setTopWinner] = useState<{ address: string; wins: number; dec_block: number; cur_block: number } | null>(null);
  const [isUserStatsLoading, setIsUserStatsLoading] = useState(false);
  const [isTopWinnerStatsLoading, setIsTopWinnerStatsLoading] = useState(false);


  const {
    playMove,
    getUserStats,
    getTopWinner,
    requestDecryption,
    isLoading,
    error
  } = useGame(fhevm, account);


  const loadTopWinnerGameData = async () => {
    try {
      const [stats] = await Promise.all([
        getTopWinner()
      ]);

      if (stats && stats.address) {
        setTopWinner({
          address: stats.address,
          wins: typeof stats.wins === 'bigint' ? Number(stats.wins) : stats.wins,
          dec_block: typeof stats.dec_block === 'bigint' ? Number(stats.dec_block) : stats.dec_block,
          cur_block: typeof stats.cur_block === 'bigint' ? Number(stats.cur_block) : stats.cur_block,
        });
      } else {
        setTopWinner({
          address: "",
          wins: typeof stats.wins === 'bigint' ? Number(stats.wins) : stats.wins,
          dec_block: typeof stats.dec_block === 'bigint' ? Number(stats.dec_block) : stats.dec_block,
          cur_block: typeof stats.cur_block === 'bigint' ? Number(stats.cur_block) : stats.cur_block,
        });
      }
    } catch (err) {
      console.error('Error loading top winner data:', err);
    }
  };

  const loadUserGameData = async () => {
    setGameMessage('Loading your private stats...');
    setIsUserStatsLoading(true);
    try {
      const [stats] = await Promise.all([
        getUserStats(),
      ]);

      setUserStats({
        wins: typeof stats.wins === 'bigint' ? Number(stats.wins) : typeof stats.wins === 'string' ? parseInt(stats.wins, 10) : typeof stats.wins === 'boolean' ? (stats.wins ? 1 : 0) : stats.wins,
        losses: typeof stats.losses === 'bigint' ? Number(stats.losses) : typeof stats.losses === 'string' ? parseInt(stats.losses, 10) : typeof stats.losses === 'boolean' ? (stats.losses ? 1 : 0) : stats.losses,
        ties: typeof stats.ties === 'bigint' ? Number(stats.ties) : typeof stats.ties === 'string' ? parseInt(stats.ties, 10) : typeof stats.ties === 'boolean' ? (stats.ties ? 1 : 0) : stats.ties,
      });
      setGameMessage('Load private stats successfully!');
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {

      setIsUserStatsLoading(false);
    }
  };

  React.useEffect(() => {
    loadTopWinnerGameData();
    // loadUserGameData();
  }, []);

  const handlePlayMove = async (move: number) => {
    setSelectedMove(move);
    setGameMessage('Processing your move...');
    // loadUserGameData();
    // const account = getAccount(config);

    try {
      const result = await playMove(move);

      if (result.success) {
        setGameMessage('Move played successfully!');
        // await loadUserGameData();
        onGamePlayed();
      } else {
        setGameMessage(`Failed to play move: ${result.error}`);
      }
    } catch (err) {
      console.error('Error playing move:', err);
      setGameMessage('Failed to play move. Please try again.');
    }
  };

  const handleRequestDecryption = async () => {
    setGameMessage('Requesting decryption...');

    try {
      const result = await requestDecryption();

      if (result.success) {
        loadTopWinnerGameData();
        setGameMessage('Decryption success!');
      } else {
        setGameMessage(`Failed to request decryption: ${result.error}`);
      }
    } catch (err) {
      console.error('Error requesting decryption:', err);
      setGameMessage('Failed to request decryption. Please try again.');
    }
  };

  const getMoveEmoji = (move: number) => {
    return CONFIG.MOVE_EMOJIS[move];
  };

  const getMoveName = (move: number) => {
    return CONFIG.MOVE_NAMES[move];
  };

  return (
    <div className="game-board">
      <div className="game-section">
        <h2>Choose Your Move</h2>
        <div className="moves-container">
          {CONFIG.MOVE_NAMES.map((moveName, index) => (
            <button
              key={index}
              onClick={() => handlePlayMove(index)}
              disabled={isLoading}
              className={`move-button ${selectedMove === index ? 'selected' : ''}`}
            >
              <div className="move-emoji">{getMoveEmoji(index)}</div>
              <div className="move-name">{moveName}</div>
            </button>
          ))}
        </div>

        {selectedMove !== null && (
          <div className="selected-move">
            You selected: {getMoveEmoji(selectedMove)} {getMoveName(selectedMove)}
          </div>
        )}
      </div>

      <div className="status-section">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        {gameMessage && (
          <div className="game-message">
            {gameMessage}
          </div>
        )}
        {isLoading && (
          <div className="loading-indicator">
            Processing...
          </div>
        )}
      </div>

      <div className="stats-section">
        <h3>🔐 Your Statistics (Private) </h3>
        {userStats ? (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-emoji">🏆</div>
              <div className="stat-value">{userStats.wins}</div>
              <div className="stat-label">Wins</div>
            </div>
            <div className="stat-card">
              <div className="stat-emoji">💔</div>
              <div className="stat-value">{userStats.losses}</div>
              <div className="stat-label">Losses</div>
            </div>
            <div className="stat-card">
              <div className="stat-emoji">🤝</div>
              <div className="stat-value">{userStats.ties}</div>
              <div className="stat-label">Ties</div>
            </div>
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-emoji">🏆</div>
              <div className="stat-value">N/A</div>
              <div className="stat-label">Wins</div>
            </div>
            <div className="stat-card">
              <div className="stat-emoji">💔</div>
              <div className="stat-value">N/A</div>
              <div className="stat-label">Losses</div>
            </div>
            <div className="stat-card">
              <div className="stat-emoji">🤝</div>
              <div className="stat-value">N/A</div>
              <div className="stat-label">Ties</div>
            </div>
          </div>
        )}


        <button
          onClick={loadUserGameData}
          disabled={isLoading || (isUserStatsLoading || false)}
          className="decrypt-button"
        >
          {isUserStatsLoading ? 'Loading...' : 'Load Private Stats'}
        </button>
      </div>

      <div className="decryption-section">
        <h3>🔐 Top Player (Decrypted)</h3>
        {topWinner ? (
          <div className="top-winner-info">
            {topWinner.address ? (
              <>
                <p className="winner-address">
                  {topWinner.address}
                </p>
                <p className="winner-wins">🏆 {topWinner.wins} wins</p>
                <p> decrypted at block: {topWinner.dec_block}, current block: {topWinner.cur_block}</p>
              </>
            ) : (
              <p>No winner data available</p>
            )}
          </div>
        ) : (
          <p>N/A</p>
        )}

        <button
          onClick={handleRequestDecryption}
          disabled={isLoading || isTopWinnerStatsLoading}
          className="decrypt-button"
        >
          {isTopWinnerStatsLoading ? 'Decrypting...' : 'Request Latest Decryption'}
        </button>
      </div>

      <div className="game-info">
        <h4>🎮 How to Play</h4>
        <ul>
          <li>Connect your wallet (OKX, MetaMask, or WalletConnect)</li>
          <li>Choose Rock (✊), Paper (✋), or Scissors (✌️)</li>
          <li>Your move is encrypted using FHE for privacy</li>
          <li>The game compares your move with a random encrypted choice</li>
          <li>Win/loss stats are stored encrypted on-chain</li>
          <li>Request decryption to see the top player score</li>
        </ul>
      </div>
    </div>
  );
};

export default GameBoard;