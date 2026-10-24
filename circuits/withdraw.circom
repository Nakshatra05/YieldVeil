pragma circom 2.2.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// TESTNET V1: full-note withdrawals. No association-set policy or partial spends.
template Withdraw(depth) {
    signal input root;
    signal input nullifierHash;
    signal input value;
    signal input context;
    signal input mode;
    signal input exposedCommitment;
    signal input nullifier;
    signal input secret;
    signal input siblings[depth];
    signal input pathIndices[depth];
    signal output authorization;

    mode * (mode - 1) === 0;
    component range = Num2Bits(128);
    range.in <== value;
    component pre = Poseidon(2);
    pre.inputs[0] <== nullifier;
    pre.inputs[1] <== secret;
    component leaf = Poseidon(2);
    leaf.inputs[0] <== value;
    leaf.inputs[1] <== pre.out;
    component spent = Poseidon(2);
    spent.inputs[0] <== nullifier;
    spent.inputs[1] <== 0;
    spent.out === nullifierHash;
    exposedCommitment === mode * leaf.out;
    component binding = Poseidon(2);
    binding.inputs[0] <== nullifier;
    binding.inputs[1] <== context;
    authorization <== binding.out;

    signal nodes[depth + 1];
    signal left[depth];
    signal right[depth];
    component hashes[depth];
    nodes[0] <== leaf.out;
    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;
        left[i] <== nodes[i] + pathIndices[i] * (siblings[i] - nodes[i]);
        right[i] <== siblings[i] + pathIndices[i] * (nodes[i] - siblings[i]);
        hashes[i] = Poseidon(2);
        hashes[i].inputs[0] <== left[i];
        hashes[i].inputs[1] <== right[i];
        nodes[i + 1] <== hashes[i].out;
    }
    nodes[depth] === root;
}
// Public order: authorization (output), root, nullifierHash, value, context, mode, exposedCommitment.
component main {public [root, nullifierHash, value, context, mode, exposedCommitment]} = Withdraw(16);
