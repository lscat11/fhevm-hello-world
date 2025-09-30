import { FHERPS, FHERPS__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHERPS")) as FHERPS__factory;
  const fheRpsContract = (await factory.deploy()) as FHERPS;
  const fheRpsContractAddress = await fheRpsContract.getAddress();

  return { fheRpsContract, fheRpsContractAddress };
}

describe("FHERps", function () {
  let signers: Signers;
  let fheRpsContract: FHERPS;
  let fheRpsContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ fheRpsContract, fheRpsContractAddress } = await deployFixture());
  });

  it("should be deployed", async function () {
    console.log(`FHERps has been deployed at address ${fheRpsContractAddress}`);
    // Test the deployed address is valid
    expect(ethers.isAddress(fheRpsContractAddress)).to.eq(true);
  });

  it("test rock,paper,scissors", async function () {
    const rock = 0;
    const paper = 1;
    const scissors = 2;

    const encryptedRock = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(rock)
      .encrypt();

    const encryptedPaper = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(paper)
      .encrypt();

    const encryptedScissors = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(scissors)
      .encrypt();

    const tx_rock = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedRock.handles[0], encryptedRock.inputProof);
    await tx_rock.wait();
    const tx_paper = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedPaper.handles[0], encryptedPaper.inputProof);
    await tx_paper.wait();
    const tx_scissors = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedScissors.handles[0], encryptedScissors.inputProof);
    await tx_scissors.wait();

    const [encryptedWin, encryptedLoss, encryptedTie] = await fheRpsContract.getWinLossTieStats(signers.alice);
    console.log(`${encryptedWin}`);

    const clearWin = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedWin,
      fheRpsContractAddress,
      signers.alice,
    );
    const clearLoss = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedLoss,
      fheRpsContractAddress,
      signers.alice,
    );
    const clearTie = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedTie,
      fheRpsContractAddress,
      signers.alice,
    );

    console.log(`win ${clearWin}, loss ${clearLoss}, tie ${clearTie}`);

    {
      await fheRpsContract.decryptTopWinner();
      await fhevm.awaitDecryptionOracle();
      const clear_top_winner_address = await fheRpsContract.clear_top_winner_address();
      const clear_top_win_amount = await fheRpsContract.clear_top_win_amount();
      const block = await fheRpsContract.latest_decrypt_block();

      console.log(`top winner ${clear_top_winner_address}, top win amount ${clear_top_win_amount}, block ${block}`);
    }

    {
      await fheRpsContract.decryptTopWinner();
      await fhevm.awaitDecryptionOracle();
      const clear_top_winner_address = await fheRpsContract.clear_top_winner_address();
      const clear_top_win_amount = await fheRpsContract.clear_top_win_amount();
      const block = await fheRpsContract.latest_decrypt_block();

      console.log(`top winner ${clear_top_winner_address}, top win amount ${clear_top_win_amount}, block ${block}`);
    }

    const [clear_top_winner_address, clear_top_win_amount, is_decrypting, latest_decrypt_block] = await fheRpsContract.getTopWinnerStats();
    console.log(`top winner ${clear_top_winner_address}, top win amount ${clear_top_win_amount}, block ${latest_decrypt_block}, is decrypting ${is_decrypting}`);

  });
});
