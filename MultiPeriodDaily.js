﻿exports.newMultiPeriodDaily = function newMultiPeriodDaily(bot, logger, COMMONS, UTILITIES, BLOB_STORAGE, USER_BOT_MODULE, COMMONS_MODULE) {

    const FULL_LOG = true;
    const LOG_FILE_CONTENT = false;

    const MODULE_NAME = "Multi Period Daily";

    const EXCHANGE_NAME = "Poloniex";

    const commons = COMMONS.newCommons(bot, logger, UTILITIES);

    thisObject = {
        initialize: initialize,
        start: start
    };

    let utilities = UTILITIES.newCloudUtilities(bot, logger);

    let statusDependencies;
    let dataDependencies;
    let storages = [];
    let dataFiles = [];

    let usertBot;
    let currentBotStorage = BLOB_STORAGE.newBlobStorage(bot, logger);

    return thisObject;

    function initialize(pStatusDependencies, pDataDependencies, callBackFunction) {

        try {

            logger.fileName = MODULE_NAME;
            logger.initialize();

            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] initialize -> Entering function."); }

            statusDependencies = pStatusDependencies;
            dataDependencies = pDataDependencies;

            for (let i = 0; i < dataDependencies.config.length; i++) {

                let key;
                let storage;
                let dependency = dataDependencies.config[i];

                key = dependency.devTeam + "-" +
                    dependency.bot + "-" +
                    dependency.product + "-" +
                    dependency.dataSet + "-" +
                    dependency.dataSetVersion

                storage = dataDependencies.dataSets.get(key);

                storages.push(storage);

            }

            currentBotStorage.initialize(bot.devTeam, onStorageInizialized);

            function onStorageInizialized(err) {

                if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                    usertBot = USER_BOT_MODULE.newUserBot(bot, logger, COMMONS_MODULE, UTILITIES, BLOB_STORAGE);
                    usertBot.initialize(dataDependencies, callBackFunction);

                } else {
                    logger.write(MODULE_NAME, "[ERROR] initialize -> onStorageInizialized -> err = " + err.message);
                    callBackFunction(err);
                }
            }

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] initialize -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function start(callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> Entering function."); }

            let market = global.MARKET;

            /* Context Variables */

            let contextVariables = {
                lastFile: undefined,                // Datetime of the last file files sucessfully produced by this process.
                dateBeginingOfMarket: undefined,          // Datetime of the first trade file in the whole market history.
                dateEndOfMarket: undefined                  // Datetime of the last file available to be used as an input of this process.
            };

            let previousDay;                        // Holds the date of the previous day relative to the processing date.
            let currentDate;                        // Holds the processing date.

            getContextVariables();

            function getContextVariables() {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> Entering function."); }

                    let thisReport;
                    let reportKey;
                    let statusReport;

                    /* We look first for Charly in order to get when the market starts. */

                    reportKey = "AAMasters" + "-" + "AACharly" + "-" + "Poloniex-Historic-Trades" + "-" + "dataSet.V1";
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> reportKey = " + reportKey); }

                    statusReport = statusDependencies.statusReports.get(reportKey);

                    if (statusReport === undefined) { // This means the status report does not exist, that could happen for instance at the begining of a month.
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> Status Report does not exist. Retrying Later. ");
                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                        return;
                    }

                    if (statusReport.status === "Status Report is corrupt.") {
                        logger.write(MODULE_NAME, "[ERROR] start -> getContextVariables -> Can not continue because dependecy Status Report is corrupt. ");
                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                        return;
                    }

                    thisReport = statusDependencies.statusReports.get(reportKey).file;

                    if (thisReport.lastFile === undefined) {
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> Undefined Last File. -> reportKey = " + reportKey);
                        logger.write(MODULE_NAME, "[HINT] start -> getContextVariables -> It is too early too run this process since the trade history of the market is not there yet.");

                        let customOK = {
                            result: global.CUSTOM_OK_RESPONSE.result,
                            message: "Dependency does not exist."
                        }
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> customOK = " + customOK.message);
                        callBackFunction(customOK);
                        return;
                    }

                    contextVariables.dateBeginingOfMarket = new Date(thisReport.lastFile.year + "-" + thisReport.lastFile.month + "-" + thisReport.lastFile.days + " " + thisReport.lastFile.hours + ":" + thisReport.lastFile.minutes + GMT_SECONDS);

                    /* Second, we get the report from Olivia, to know when the marted ends. */

                    reportKey = "AAMasters" + "-" + "AAOlivia" + "-" + "Multi-Period-Daily" + "-" + "dataSet.V1";
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> reportKey = " + reportKey); }

                    statusReport = statusDependencies.statusReports.get(reportKey);

                    if (statusReport === undefined) { // This means the status report does not exist, that could happen for instance at the begining of a month.
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> Status Report does not exist. Retrying Later. ");
                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                        return;
                    }

                    if (statusReport.status === "Status Report is corrupt.") {
                        logger.write(MODULE_NAME, "[ERROR] start -> getContextVariables -> Can not continue because dependecy Status Report is corrupt. ");
                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                        return;
                    }

                    thisReport = statusDependencies.statusReports.get(reportKey).file;

                    if (thisReport.lastFile === undefined) {
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> Undefined Last File. -> reportKey = " + reportKey);

                        let customOK = {
                            result: global.CUSTOM_OK_RESPONSE.result,
                            message: "Dependency not ready."
                        }
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> customOK = " + customOK.message);
                        callBackFunction(customOK);
                        return;
                    }

                    contextVariables.dateEndOfMarket = new Date(thisReport.lastFile.valueOf());

                    /* Finally we get our own Status Report. */

                    reportKey = bot.devTeam + "-" + bot.codeName + "-" + "Multi-Period-Daily" + "-" + "dataSet.V1";
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> reportKey = " + reportKey); }

                    statusReport = statusDependencies.statusReports.get(reportKey);

                    if (statusReport === undefined) { // This means the status report does not exist, that could happen for instance at the begining of a month.
                        logger.write(MODULE_NAME, "[WARN] start -> getContextVariables -> Status Report does not exist. Retrying Later. ");
                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                        return;
                    }

                    if (statusReport.status === "Status Report is corrupt.") {
                        logger.write(MODULE_NAME, "[ERROR] start -> getContextVariables -> Can not continue because self dependecy Status Report is corrupt. Aborting Process.");
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        return;
                    }

                    thisReport = statusDependencies.statusReports.get(reportKey).file;

                    if (thisReport.lastFile !== undefined) {

                        contextVariables.lastFile = new Date(thisReport.lastFile);

                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> thisReport.lastFile !== undefined"); }

                        processTimePeriods();
                        return;

                    } else {

                        /*
                        In the case when there is no status report, we take the date of the file with the first trades as the begining of the market. Then we will
                        go one day further in time, so that the previous day does fine a file at the begining of the market.
                        */

                        contextVariables.lastFile = new Date(contextVariables.dateBeginingOfMarket.getUTCFullYear() + "-" + (contextVariables.dateBeginingOfMarket.getUTCMonth() + 1) + "-" + contextVariables.dateBeginingOfMarket.getUTCDate() + " " + "00:00" + GMT_SECONDS);
                        contextVariables.lastFile = new Date(contextVariables.lastFile.valueOf() + ONE_DAY_IN_MILISECONDS);

                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> thisReport.lastFile === undefined"); }
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getContextVariables -> contextVariables.lastFile = " + contextVariables.lastFile); }

                        processTimePeriods();
                        return;
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getContextVariables -> err = " + err.message);
                    if (err.message === "Cannot read property 'file' of undefined") {
                        logger.write(MODULE_NAME, "[HINT] start -> getContextVariables -> Check the bot configuration to see if all of its statusDependencies declarations are correct. ");
                        logger.write(MODULE_NAME, "[HINT] start -> getContextVariables -> Dependencies loaded -> keys = " + JSON.stringify(statusDependencies.keys));
                    }
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function processTimePeriods() {

                if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> Entering function."); }

                try {

                    let n;

                    advanceTime();

                    function advanceTime() {

                        try {

                            logger.newInternalLoop(bot.codeName, bot.process);

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> advanceTime -> Entering function."); }

                            currentDate = new Date(currentDate.valueOf() + ONE_DAY_IN_MILISECONDS);
                            previousDay = new Date(currentDate.valueOf() - ONE_DAY_IN_MILISECONDS);

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> advanceTime -> currentDate = " + currentDate); }
                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> advanceTime -> previousDay = " + previousDay); }

                            /* Validation that we are not going past the head of the market. */

                            if (currentDate.valueOf() > contextVariables.dateEndOfMarket.valueOf()) {

                                const logText = "Head of the market found @ " + previousDay.getUTCFullYear() + "/" + (previousDay.getUTCMonth() + 1) + "/" + previousDay.getUTCDate() + ".";
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> advanceTime -> " + logText); }

                                callBackFunction(global.DEFAULT_OK_RESPONSE);
                                return;

                            }

                            periodsLoop();

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> advanceTime -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function periodsLoop() {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoop -> Entering function."); }

                            /*
            
                            We will iterate through all posible periods.
            
                            */

                            n = 0   // loop Variable representing each possible period as defined at the periods array.

                            periodsLoopBody();

                        }
                        catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoop -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function periodsLoopBody() {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> Entering function."); }

                            const outputPeriod = global.dailyFilesPeriods[n][0];
                            const timePeriod = global.dailyFilesPeriods[n][1];

                            let dependencyIndex = 0;
                            dataFiles = [];

                            dependencyLoopBody();

                            function dependencyLoopBody() {

                                try {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> Entering function."); }

                                    let dependency = dataDependencies.config[dependencyIndex];
                                    let storage = storages[dependencyIndex];

                                    let previousFile;
                                    let currentFile;

                                    getPreviousFile();

                                    function getPreviousFile() {

                                        try {

                                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> Entering function."); }

                                            let dateForPath = previousDay.getUTCFullYear() + '/' + utilities.pad(previousDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(previousDay.getUTCDate(), 2);
                                            let filePath = dependency.product + '/' + "Multi-Period-Daily" + "/" + timePeriod + "/" + dateForPath;
                                            let fileName = market.assetA + '_' + market.assetB + ".json";

                                            storage.getTextFile(filePath, fileName, onFileReceived, true);

                                            function onFileReceived(err, text) {

                                                try {

                                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> onFileReceived -> Entering function."); }
                                                    if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> onFileReceived -> text = " + text); }

                                                    if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> onFileReceived -> err = " + err.message);
                                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> onFileReceived -> filePath = " + filePath);
                                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> onFileReceived -> fileName = " + fileName);
                                                        callBackFunction(err);
                                                        return;
                                                    }

                                                    previousFile = JSON.parse(text);

                                                    getCurrentFile();

                                                }
                                                catch (err) {
                                                    logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> onFileReceived -> err = " + err.message);
                                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                                }
                                            }
                                        }
                                        catch (err) {
                                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getPreviousFile -> err = " + err.message);
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                        }
                                    }

                                    function getCurrentFile() {

                                        try {

                                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> Entering function."); }

                                            let dateForPath = currentDay.getUTCFullYear() + '/' + utilities.pad(previousDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(previousDay.getUTCDate(), 2);
                                            let filePath = dependency.product + '/' + "Multi-Period-Daily" + "/" + timePeriod + "/" + dateForPath;
                                            let fileName = market.assetA + '_' + market.assetB + ".json";

                                            storage.getTextFile(filePath, fileName, onFileReceived, true);

                                            function onFileReceived(err, text) {

                                                try {

                                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> onFileReceived -> Entering function."); }
                                                    if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> onFileReceived -> text = " + text); }

                                                    if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> onFileReceived -> err = " + err.message);
                                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> onFileReceived -> filePath = " + filePath);
                                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> onFileReceived -> fileName = " + fileName);
                                                        callBackFunction(err);
                                                        return;
                                                    }

                                                    currentFile = JSON.parse(text);

                                                    let datafile = previousFile.concat(currentFile);

                                                    dataFiles.push(dataFile);
                                                    dependencyControlLoop();

                                                }
                                                catch (err) {
                                                    logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> onFileReceived -> err = " + err.message);
                                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                                }
                                            }
                                        }
                                        catch (err) {
                                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> dependencyLoopBody -> getCurrentFile -> err = " + err.message);
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                        }
                                    }
                                }
                                catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoop -> dependencyLoopBody -> err = " + err.message);
                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                }
                            }

                            function dependencyControlLoop() {

                                try {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> dependencyControlLoop -> Entering function."); }

                                    dependencyIndex++;

                                    if (dependencyIndex < dataDependencies.config.length) {

                                        dependencyLoopBody();

                                    } else {

                                        callTheBot();

                                    }
                                }
                                catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> dependencyControlLoop -> err = " + err.message);
                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                }
                            }

                            function callTheBot() {

                                try {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> callTheBot -> Entering function."); }

                                    const outputPeriod = global.dailyFilesPeriods[n][0];
                                    const timePeriod = global.dailyFilesPeriods[n][1];

                                    usertBot.start(dataFiles, outputPeriod, timePeriod, currentDate, onBotFinished);

                                    function onBotFinished(err) {

                                        try {

                                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsLoopBody -> callTheBot -> onBotFinished -> Entering function."); }

                                            if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                                                callBackFunction(err);
                                                return;
                                            }

                                            periodsControlLoop();
                                        }
                                        catch (err) {
                                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> callTheBot -> onBotFinished -> err = " + err.message);
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                        }
                                    }
                                }
                                catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> callTheBot -> err = " + err.message);
                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                }
                            }
                        }
                        catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsLoopBody -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function periodsControlLoop() {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> periodsControlLoop -> Entering function."); }

                            n++;

                            if (n < global.dailyFilesPeriods.length) {

                                periodsLoopBody();

                            } else {

                                n = 0;

                                writeDataRanges(onWritten);

                                function onWritten(err) {

                                    try {

                                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> processTimePeriods -> controlLoop -> onWritten -> Entering function."); }

                                        if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> controlLoop -> onWritten -> err = " + err.message);
                                            callBackFunction(err);
                                            return;
                                        }

                                        writeStatusReport(currentDate, advanceTime);

                                    } catch (err) {
                                        logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods ->  controlLoop -> onWritten -> err = " + err.message);
                                        callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                    }
                                }
                            }
                        }
                        catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> periodsControlLoop -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                }
                catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> processTimePeriods -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function writeDataRanges(callBack) {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeDataRanges -> Entering function."); }

                    let productIndex = 0;
                    productLoopBody();

                    function productLoopBody() {

                        let folderName = bot.products[productIndex].codeName;

                        writeDataRange(contextVariables.dateBeginingOfMarket, currentDate, folderName, controlLoop);
                    }

                    function controlLoop() {

                        productIndex++;

                        if (productIndex < bot.products.length) {
                            productLoopBody();
                        } else {
                            callBack(global.DEFAULT_OK_RESPONSE);
                        }
                    }
                }
                catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> writeDataRanges -> err = " + err.message);
                    callBack(global.DEFAULT_FAIL_RESPONSE);
                }

            }

            function writeDataRange(pBegin, pEnd, pProductFolder, callBack) {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeDataRange -> Entering function."); }

                    let dataRange = {
                        begin: pBegin.valueOf(),
                        end: pEnd.valueOf()
                    };

                    let fileContent = JSON.stringify(dataRange);

                    let fileName = 'Data.Range.' + market.assetA + '_' + market.assetB + '.json';
                    let filePath = bot.filePathRoot + "/Output/" + pProductFolder + "/" + bot.process;

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeDataRange -> fileName = " + fileName); }
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeDataRange -> filePath = " + filePath); }

                    currentBotStorage.createTextFile(filePath, fileName, fileContent + '\n', onFileCreated);

                    function onFileCreated(err) {

                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeDataRange -> onFileCreated -> Entering function."); }

                        if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                            logger.write(MODULE_NAME, "[ERROR] start -> writeDataRange -> onFileCreated -> err = " + err.message);
                            callBack(err);
                            return;
                        }

                        if (LOG_FILE_CONTENT === true) {
                            logger.write(MODULE_NAME, "[INFO] start -> writeDataRange -> onFileCreated ->  Content written = " + fileContent);
                        }

                        callBack(global.DEFAULT_OK_RESPONSE);
                    }
                }
                catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> writeDataRange -> err = " + err.message);
                    callBack(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function writeStatusReport(lastFileDate, callBack) {

                if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeStatusReport -> Entering function."); }
                if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> writeStatusReport -> lastFileDate = " + lastFileDate); }

                try {

                    let reportKey = bot.devTeam + "-" + bot.codeName + "-" + "Multi-Period-Daily" + "-" + "dataSet.V1";
                    let thisReport = statusDependencies.statusReports.get(reportKey);

                    thisReport.file.lastExecution = bot.currentDatetime;
                    thisReport.file.lastFile = lastFileDate;
                    thisReport.save(callBack);

                }
                catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> writeStatusReport -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }
        }

        catch (err) {
            logger.write(MODULE_NAME, "[ERROR] start -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }
};
