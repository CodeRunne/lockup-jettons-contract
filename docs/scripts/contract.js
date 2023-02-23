const querySearch = new URLSearchParams(window.location.search);
const contractAddress = querySearch.get("address");
const today = new Date().toISOString().slice(0, 16);

let contractRetry = true;

const tonweb = new TonWeb(
  new TonWeb.HttpProvider(
    "https://" +
      (window.localStorage.getItem("testnet") === "true"
        ? "testnet.toncenter.com/api/v2/jsonRPC"
        : "scalable-api.tonwhales.com/jsonRPC"),
    {}
  )
);
const Cell = tonweb.boc.Cell;

let subdomain =
  window.localStorage.getItem("testnet") === "true" ? "testnet." : "";
let currentTonWallets = [];
let buttonType = "pay";
let selectedToken = null;

const contractData = {
  balances: {},
  metadata: {},
};

const userData = {
  balances: {},
};

const countCharts = function (string, c) {
  var result = 0,
    i = 0;
  for (i; i < string.length; i++) if (string[i] === c) result++;
  return result;
};

const convertBalance = (number = 0, decimals = 9) => {
  return number / 10 ** Number(decimals);
};

const numberToLocalString = (number = 0) => {
  return number.toLocaleString("en-En");
};

const msToDate = (s) => {
  return new Date(s).toLocaleString().replace(",", "");
};

const toPlainString = (num) => {
  return ("" + +num).replace(
    /(-?)(\d*)\.?(\d*)e([+-]\d+)/,
    function (a, b, c, d, e) {
      return e < 0
        ? b + "0." + Array(1 - e - c.length).join(0) + c + d
        : b + c + d + Array(e - d.length + 1).join(0);
    }
  );
};

const updateList = () => {
  const selectList = document.getElementById("tokenSelect");
  const walletBalanceEl = document.getElementById("walletBalance");

  selectList.innerHTML = "";

  const object = buttonType === "pay" ? userData : contractData;

  const isTonExist = object.balances.TON || null;

  if (selectedToken && !object.balances[selectedToken]) {
    selectedToken = null;
  }

  if (!selectedToken && isTonExist) {
    selectedToken = "TON";
  }

  Object.values(object.balances).forEach((token, index) => {
    const { metadata } = token;
    const { symbol } = metadata;

    if (!selectedToken && !isTonExist && index === 0) {
      selectedToken = symbol;
    }

    selectList.innerHTML += `<option value="${symbol}">${symbol}</option>`;
  });

  const selectedTokenBalance = object.balances[selectedToken]?.balance || 0;

  if (!isNaN(selectedTokenBalance)) {
    walletBalanceEl.innerText = `Balance: ${numberToLocalString(
      selectedTokenBalance
    )} ${selectedToken}`;
  }

  selectList.value = selectedToken;
};

const loadWallets = async () => {
  const result = await window.ton.send("ton_requestAccounts");

  currentTonWallets = result || [];
};

const getContractTonBalance = async (
  searchAddress = contractAddress,
  object = contractData
) => {
  const result = await fetch(
    `https://${subdomain}tonapi.io/v1/account/getInfo?account=${searchAddress}`,
    {
      headers: {
        ["Content-Type"]: "application/json",
      },
    }
  ).then((res) => res.json());

  const { balance, address, icon } = result;
  const { bounceable } = address;

  object.balances.TON = {
    balance: convertBalance(balance),
    walletAddress: bounceable,
    metadata: {
      symbol: "TON",
      image: icon,
      decimals: 9,
    },
    isNative: true,
  };
};

const getContractJettonsBalance = async (
  searchAddress = contractAddress,
  object = contractData
) => {
  const result = await fetch(
    `https://${subdomain}tonapi.io/v1/jetton/getBalances?account=${searchAddress}`,
    {
      headers: {
        ["Content-Type"]: "application/json",
      },
    }
  ).then((res) => res.json());

  result.balances.forEach((value) => {
    const { balance, metadata, wallet_address } = value;
    const { symbol, decimals, image } = metadata;
    const { address } = wallet_address;

    object.balances[symbol] = {
      balance: convertBalance(balance, decimals),
      walletAddress: address,
      metadata: {
        symbol,
        image,
        decimals,
      },
      isNative: false,
    };
  });
};

const getContractInfo = async () => {
  let result = await tonweb.provider.call2(contractAddress, "lockup_data");
  let owner = result[0].beginParse().loadAddress();
  let receiver = result[1].beginParse().loadAddress();

  contractData.metadata = {
    owner: owner ? owner.toString(1, 1, 1) : null,
    receiver: receiver ? receiver.toString(1, 1, 1) : null,
    unlockedAt: parseInt(result[2].toString()),
  };

  if (currentTonWallets.includes(contractData.metadata.owner)) {
    document
      .getElementById("updateTimeBlock")
      .classList.remove("actions__block_hidden");
  }

  const now = Date.now();
  const contractUnblockedAt = contractData.metadata.unlockedAt
    ? Number(contractData.metadata.unlockedAt * 1000)
    : 0;

  if (!contractUnblockedAt || contractUnblockedAt < now) {
    document.getElementById("unblockTime").innerText = "Unblocked";
  }

  if (contractUnblockedAt && contractUnblockedAt > now) {
    document.getElementById("unblockTime").innerText = `${msToDate(
      contractUnblockedAt
    )}`;
  }

  document.getElementById("from").innerText = contractData.metadata.owner;
  document.getElementById("to").innerText = contractData.metadata.receiver;
};

const payTypeChanged = () => {
  if (buttonType === "withdraw") {
    buttonType = "pay";
  } else if (buttonType === "pay") {
    buttonType = "withdraw";
  }

  document.getElementById("amount").value = "";

  updateList();

  const isWithdrawAviable = currentTonWallets.includes(
    contractData.metadata.receiver
  );

  const operationButton = document.getElementById("payFormButton");

  operationButton.innerText =
    buttonType === "withdraw" && !isWithdrawAviable
      ? "Not aviable"
      : buttonType;

  if (!isWithdrawAviable && buttonType === "withdraw") {
    operationButton.classList.remove("button--primary");
    operationButton.classList.add("button--secondary");

    document.getElementById("amountInputWrapper").style.display = "none";
    document.getElementById("walletBalanceWrapper").style.display = "none";
  } else {
    operationButton.classList.remove("button--secondary");
    operationButton.classList.add("button--primary");

    document.getElementById("amountInputWrapper").style.display = "flex";
    document.getElementById("walletBalanceWrapper").style.display = "block";
  }
};

const tokenSelectedChange = () => {
  document.getElementById("amount").value = "";

  const newSelectedToken =
    document.getElementById("tokenSelect").selectedOptions[0].value;

  selectedToken = newSelectedToken;

  updateList();
};

const changeUnblockTime = () => {
  let newUnblockTime = document.getElementById("updateUblockTime").value;

  if (!newUnblockTime) {
    return;
  } else {
    const unblockDate = new Date(newUnblockTime);
    newUnblockTime = Math.trunc(unblockDate.getTime() / 1000);
  }

  extendUnlockTime(newUnblockTime);
};

const onAmountChange = () => {
  const inputEl = document.getElementById("amount");

  const object =
    buttonType === "pay" ? userData.balances : contractData.balances;
  const tokenData = object[selectedToken];

  let newValue = (inputEl.value || "").replace(/[^\d.]+/g, "");

  if (countCharts(newValue || "", ".") > 1) {
    inputEl.value = Math.trunc(tokenData.balance);

    return false;
  }

  if (countCharts(newValue || "", ".") === 1) {
    const chartsAfterDot = newValue.split(".")[1];

    if (chartsAfterDot.length > tokenData.metadata.decimals) {
      inputEl.value = tokenData.balance;

      return false;
    }
  }

  if (Number(inputEl.value) > Number(tokenData.balance)) {
    inputEl.value = tokenData.balance;

    return false;
  }

  inputEl.value = newValue;
};

const depositFunds = async (symbol, amount) => {
  if (userData.balances[symbol].balance < amount) {
    alert("Insufficient funds");
    return;
  }

  if (userData.balances[symbol].isNative) {
    // if this TON
    let query = {
      to: contractAddress,
      value: toPlainString(
        amount * 10 ** userData.balances[symbol].metadata.decimals
      ),
    };

    await window.ton.send("ton_sendTransaction", [query]);
  } else {
    // work with jettons
    let msgBody = new Cell();
    msgBody.bits.writeUint(0xf8a7ea5, 32);
    msgBody.bits.writeUint(0, 64);
    msgBody.bits.writeCoins(new tonweb.utils.BN("AMOUNT"));
    msgBody.bits.writeAddress(new tonweb.Address(contractAddress)); // destination address
    msgBody.bits.writeAddress(new tonweb.Address(contractAddress)); // gas response address
    msgBody.bits.writeUint(0, 1);
    msgBody.bits.writeCoins(new tonweb.utils.BN("0.05"));
    msgBody.bits.writeUint(0, 1);

    let query = {
      to: new tonweb.Address(userData.balances[symbol].walletAddress),
      value: toPlainString(
        amount * 10 ** userData.balances[symbol].metadata.decimals
      ),
      data: tonweb.utils.bytesToBase64(await msgBody.toBoc(false)),
      dataType: "boc",
    };

    await window.ton.send("ton_sendTransaction", [query]);
  }
};

const withdrawFunds = async (symbol, targetAddress, amount) => {
  if (contractData.balances[symbol].balance < amount) {
    alert("Insufficient funds");
    return;
  }

  if (contractData.balances[symbol].isNative) {
    // if this TON
    let msgBody = new Cell();
    msgBody.bits.writeAddress(new tonweb.Address(targetAddress));
    msgBody.bits.writeCoins(tonweb.utils.toNano(amount.toString()));

    let payload = new Cell();
    payload.bits.writeUint(0xb5de5f9e, 32);
    payload.bits.writeUint(0, 64);
    payload.refs.push(msgBody);

    let query = {
      to: contractAddress,
      value: tonweb.utils.toNano("0.05"),
      data: tonweb.utils.bytesToBase64(await payload.toBoc(false)),
      dataType: "boc",
    };

    await window.ton.send("ton_sendTransaction", [query]);
  } else {
    // work with jettons
    let transferMsgBody = new Cell();
    msgBody.bits.writeUint(0xf8a7ea5, 32);
    msgBody.bits.writeUint(0, 64);
    msgBody.bits.writeCoins(new tonweb.utils.BN("AMOUNT"));
    msgBody.bits.writeAddress(new tonweb.Address(targetAddress)); // destination address
    msgBody.bits.writeAddress(new tonweb.Address(targetAddress)); // gas response address
    msgBody.bits.writeUint(0, 1);
    msgBody.bits.writeCoins(new tonweb.utils.BN("0.001"));
    msgBody.bits.writeUint(0, 1);

    let msgBody = new Cell();
    msgBody.bits.writeAddress(
      new tonweb.Address(contractData.balances[symbol].walletAddress)
    );
    msgBody.bits.writeCoins(tonweb.utils.toNano("0.05"));
    msgBody.refs.push(transferMsgBody);

    let payload = new Cell();
    payload.bits.writeUint(0xb5de5f9e, 32);
    payload.bits.writeUint(0, 64);
    payload.refs.push(msgBody);

    let query = {
      to: new tonweb.Address(contractAddress),
      value: tonweb.utils.toNano("0.06"),
      data: tonweb.utils.bytesToBase64(await payload.toBoc(false)),
      dataType: "boc",
    };

    await window.ton.send("ton_sendTransaction", [query]);
  }
};

const operationButton = () => {
  const amount = document.getElementById("amount").value;

  if (!amount) {
    return alert("Amount must be more of 0");
  }

  const object =
    buttonType === "pay" ? userData.balances : contractData.balances;
  const tokenData = object[selectedToken];

  if (!tokenData) {
    return alert('An error occured"');
  }

  if (amount > tokenData.balance) {
    return alert('Not enough balance"');
  }

  if (buttonType === "pay") {
    depositFunds(selectedToken, amount);
  } else {
    if (!currentTonWallets.includes(contractData.metadata.receiver)) {
      return alert("You aren't receiver of this contract");
    }

    withdrawFunds(selectedToken, contractData.metadata.receiver, amount);
  }
};

const extendUnlockTime = async (extendValue) => {
  let payload = new Cell();
  payload.bits.writeUint(0xceba1400, 32);
  payload.bits.writeUint(0, 64);
  payload.bits.writeUint(extendValue, 64);

  let query = {
    to: contractAddress,
    value: "50000000",
    data: tonweb.utils.bytesToBase64(await payload.toBoc(false)),
    dataType: "boc",
  };

  await window.ton.send("ton_sendTransaction", [query]);
};

const goHome = () => {
  window.location.pathname = "/";
};

const loadDOM = () => {
  if (!window.ton && contractRetry) {
    setTimeout(() => {
      loadDOM();
    }, 1000);

    return;
  }

  if (!contractAddress || (!window.ton && !contractRetry)) {
    window.location = "/";

    return;
  }

  document.getElementById("updateUblockTime").min = today;
  document.getElementById("contractId").innerText = contractAddress;

  document.getElementById("payFormButton").innerText = buttonType;

  loadWallets().then(() => {
    Promise.all([
      getContractTonBalance(),
      getContractJettonsBalance(),
      getContractInfo(),
      getContractTonBalance(currentTonWallets[0], userData),
      getContractJettonsBalance(currentTonWallets[0], userData),
    ]).then(() => {
      updateList();
    });
  });
};

window.addEventListener("DOMContentLoaded", loadDOM);
