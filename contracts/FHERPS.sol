// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FHE, euint8, euint64, ebool, externalEuint8, eaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHERPS is SepoliaConfig {
    /**
     * @notice 0 = Rock, 1 = Paper, 2 = Scissors
     */
    euint8 private _rps;
    eaddress private _top_winner_address;
    euint64 private _top_win_amount;
    uint256 private _decrypt_request_id;
    uint256 private _decrypt_request_block;

    mapping(address account => euint64 winAmount) private _win_map;
    mapping(address account => euint64 lossAmount) private _loss_map;
    mapping(address account => euint64 tieAmount) private _tie_map;

    uint256 public latest_decrypt_block;
    bool public is_decrypting;
    address public clear_top_winner_address;
    uint64 public clear_top_win_amount;

    constructor() {
        euint64 r64 = FHE.randEuint64();
        _rps = FHE.asEuint8(FHE.rem(r64, 3));
        FHE.allowThis(_rps);
        is_decrypting = false;
    }

    function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
        euint8 encryptedEuint8 = FHE.fromExternal(inputEuint8, inputProof);
        euint8 play_rps = FHE.rem(encryptedEuint8, 3);

        // calculate (3 + play_rps - _rps) % 3: 0 = tie, 1 = win, 2 = loss
        euint8 result = FHE.rem(FHE.sub(FHE.add(play_rps, 3), _rps), 3);
        ebool win = FHE.eq(result, 1);
        ebool tie = FHE.eq(result, 0);
        ebool loss = FHE.eq(result, 2);

        euint64 win_update = FHE.add(_win_map[msg.sender], FHE.asEuint64(win));
        euint64 tie_update = FHE.add(_tie_map[msg.sender], FHE.asEuint64(tie));
        euint64 loss_update = FHE.add(_loss_map[msg.sender], FHE.asEuint64(loss));

        _win_map[msg.sender] = win_update;
        _tie_map[msg.sender] = tie_update;
        _loss_map[msg.sender] = loss_update;

        FHE.allowThis(win_update);
        FHE.allowThis(loss_update);
        FHE.allowThis(tie_update);

        FHE.allow(win_update, msg.sender);
        FHE.allow(loss_update, msg.sender);
        FHE.allow(tie_update, msg.sender);

        if (!FHE.isInitialized(_top_winner_address)) {
            _top_winner_address = FHE.asEaddress(msg.sender);
            _top_win_amount = win_update;
        } else {
            ebool is_new_top_winner = FHE.gt(win_update, _top_win_amount);
            _top_winner_address = FHE.select(is_new_top_winner, FHE.asEaddress(msg.sender), _top_winner_address);
            _top_win_amount = FHE.select(is_new_top_winner, win_update, _top_win_amount);
        }

        FHE.allowThis(_top_win_amount);
        FHE.allowThis(_top_winner_address);

        euint64 r64 = FHE.randEuint64();
        _rps = FHE.asEuint8(FHE.rem(r64, 3));
        FHE.allowThis(_rps);
    }

    function decryptTopWinner() external {
        _decrypt_request_block = block.number;

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_top_winner_address);
        cts[1] = FHE.toBytes32(_top_win_amount);
        FHE.requestDecryption(cts, this.resolveTopWinnerCallback.selector);
    }

    function resolveTopWinnerCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        (address resultTopWinnerAddress, uint64 resultTopWinAmount) = abi.decode(cleartexts, (address, uint64));
        clear_top_winner_address = resultTopWinnerAddress;
        clear_top_win_amount = resultTopWinAmount;
        latest_decrypt_block = _decrypt_request_block;
    }

    function getWinLossTieStats(address user) external view returns (euint64, euint64, euint64) {
        return (_win_map[user], _loss_map[user], _tie_map[user]);
    }

    function getTopWinnerStats() external view returns (address, uint64, bool, uint256) {
        return (clear_top_winner_address, clear_top_win_amount, is_decrypting, latest_decrypt_block);
    }
}
