// ==UserScript==
// @name         DuChinese Exercises Beta
// @namespace    http://tampermonkey.net/
// @version      2024-06-28
// @description  comprehension exercises beta
// @author       Frithjof, Sinamon AB
// @match        https://duchinese.net/lessons/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duchinese.net
// @grant        none
// ==/UserScript==

(async () => {
    "use strict";

    // https://stackoverflow.com/a/61511955/2766231
    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }
            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // Wait for page to load
    await waitForElement(".lesson-content");

    // Load exercise JSON file
    await $.getScript("http://localhost:63342/key-vocab-playground/grammar-questions/content.js");

    // Inject CSS
    $("head").first().append(`<link rel="stylesheet" type="text/css" href="http://localhost:63342/key-vocab-playground/grammar-questions/du-exercises.css">`);

    // Inject exercise section
    const exercisesHeaderEl = $(`
        <div class="exercises-header">
            <div class="col-xs-12 col-sm-12 col-md-7 col-lg-6 sm-mt">
                <div class="heading">Exercises</div>
                <div class="exercise-progress">
                    <div>
                        <ol class="progress-icons">
                            ${exerciseList.map((exerciseJson, exerciseNum) => {
        return `<li class="progress-icon ahead" data-exercise-num="${exerciseNum}"></li>`;
    }).join(" ")}
                        </ol>
                    </div>
                    <div>
                        <span class="progress-text">4/5</span>
                    </div>
                </div>
            </div>
        </div>`);
    const exercisesBodyEl = $(`
        <div class="exercises-body row col-fs-row">
            <div class="col-xs-12 col-md-10 col-md-push-1 col-fs" id="du-exercise-screen">
                <div class="clearfix"></div>
                <div class="exercises col-xs-12 col-sm-12 col-md-7 col-lg-6 sm-mt">
                </div>
            </div>
        </div>`);
    $(".lesson-content").first().after(exercisesBodyEl).after(exercisesHeaderEl).after("<hr>");
    const exercisesEl = exercisesBodyEl.find(".exercises");
    const progressIconsEl = $(exercisesHeaderEl).find(".progress-icons");
    const progressTextEl = $(exercisesHeaderEl).find(".progress-text");

    // Stop scrolling of "sticky header" past exercise section
    $(window).scroll(function () {
        const containerTop = exercisesHeaderEl.offset().top - $(window).scrollTop() - $(".du-translation-fixed").height();
        const navbarHeight = $(".navbar:not(.hidden)").height();
        $(".lesson-content-container .du-translation-fixed").css("top", Math.min(navbarHeight, containerTop));
    });

    const CompletionStatus = {
        Correct: "correct",
        Wrong: "wrong",
        Skipped: "skipped",
        Current: "current",
        Ahead: "ahead"
    }

    let currentQuestionNum = 0;

    const completeExercise = (exerciseJson, completionStatus) => {
        const currentProgressIconEl = progressIconsEl.find(`.progress-icon[data-exercise-num=${currentQuestionNum}]`);
        currentProgressIconEl.attr("class", `progress-icon ${completionStatus}`);
        currentProgressIconEl.addClass(completionStatus);
        if (currentQuestionNum + 1 < exerciseList.length) {
            currentQuestionNum += 1;
            exerciseJson.el.hide();
            exerciseList[currentQuestionNum].el.show();
            progressTextEl.text(`${currentQuestionNum + 1}/${exerciseList.length}`);
            const nextProgressIconEl = progressIconsEl.find(`.progress-icon[data-exercise-num=${currentQuestionNum}]`);
            nextProgressIconEl.attr("class", `progress-icon ${CompletionStatus.Current}`);
        }
    };

    // Add HTML and functionality for each exercise
    const makeExerciseEl = (questionJson) => {
        let instruction = "";
        let task = "";
        switch (questionJson.question_type) {
            case "reading":
                instruction = `
                    <div class="exercise-instruction">
                        <div>
                            <span class="exercise-type">Reading Comprehension</span>
                        </div>
                        <span>Choose the correct answer according to the reading.</span>
                    </div>`;
                task = `
                    <div class="exercise-task">
                        <span class="question">${questionJson.question}</span>
                        <ol class="answer-options">
                            ${questionJson.answer_options.map((option, optionNum) => {
                    return `<li><button type="button" class="btn choice-option-btn" data-option-num="${optionNum}">${option.chinese}</button></li>`;
                }).join("")}
                        </ol>
                    </div>
                    <div class="exercise-instruction select-option-first-text">
                        <span>Click on the answer first.</span>
                    </div>`;
                break;
            default:
                instruction = `Unknown question type: ${questionJson.question_type}`;
                break;
        }
        return $(`
            <div class="exercise">
                <form>
                    ${instruction}
                    ${task}
                    <div class="exercise-controls form-group">
                        <button type="button" class="btn check-btn">Check</button>
                        <button type="button" class="btn skip-btn">
                            <img src="http://localhost:63342/key-vocab-playground/grammar-questions/skip-button.svg">
                            Skip
                        </button>
                    </div>
                </form>
            </div>`);
    };

    const ReadingExerciseState = {
        Initial: "initial",
        SelectedOption: "selected-option",
        ClickCheckWithoutSelection: "click-check-without-selection",
        Checking: "checking"
    }

    const updateExerciseState = (exerciseJson, newState) => {
        exerciseJson.el.removeClass(`state-${exerciseJson.state}`);
        exerciseJson.el.find(".choice-option-btn, .check-btn, .skip-btn").off("click");
        exerciseJson.el.find(".check-btn").text("Check");
        const initial = () => {
            exerciseJson.el.find(".choice-option-btn").click((e) => {
                exerciseJson.el.find(".choice-option-btn").removeClass("selected");
                $(e.target).addClass("selected");
                updateExerciseState(exerciseJson, ReadingExerciseState.SelectedOption);
            });
            exerciseJson.el.find(".skip-btn").click(() => {
                completeExercise(exerciseJson, CompletionStatus.Skipped);
            });
        };
        switch (newState) {
            case ReadingExerciseState.Initial:
            case ReadingExerciseState.ClickCheckWithoutSelection:
                initial();
                exerciseJson.el.find(".check-btn").click(() => {
                    updateExerciseState(exerciseJson, ReadingExerciseState.ClickCheckWithoutSelection);
                });
                break;
            case ReadingExerciseState.SelectedOption:
                initial();
                exerciseJson.el.find(".check-btn").click(() => {
                    updateExerciseState(exerciseJson, ReadingExerciseState.Checking);
                });
                break;
            case ReadingExerciseState.Checking:
                const selectedOptionNum = exerciseJson.el.find(".choice-option-btn.selected").data("option-num");
                const correct = exerciseJson.answer_options[selectedOptionNum].correct;
                exerciseJson.answer_options.forEach((option, optionNum) => {
                    if (option.correct) {
                        exerciseJson.el.find(`.choice-option-btn[data-option-num=${optionNum}]`).addClass("correct");
                    }
                });
                if (!correct) {
                    exerciseJson.el.find(".choice-option-btn.selected").addClass("wrong");
                }
                const completionStatus = correct ? CompletionStatus.Correct : CompletionStatus.Wrong;

                exerciseJson.el.find(".check-btn").text("Next");
                exerciseJson.el.find(".check-btn").click(() => {
                    completeExercise(exerciseJson, completionStatus);
                });
                break;
        }
        exerciseJson.el.addClass(`state-${newState}`);

        exerciseJson.state = newState;
    };

    // Populate exercise list
    exerciseList.forEach((exerciseJson, exerciseNum) => {
        const exerciseEl = makeExerciseEl(exerciseJson);
        exercisesEl.append(exerciseEl);
        exerciseJson.el = exerciseEl;
        exerciseJson.num = exerciseNum;
        exerciseEl.hide();
        updateExerciseState(exerciseJson, ReadingExerciseState.Initial);
    });

    // Show first exercise
    exerciseList[currentQuestionNum].el.show();
    const nextProgressIconEl = progressIconsEl.find(`.progress-icon[data-exercise-num=${currentQuestionNum}]`);
    nextProgressIconEl.attr("class", `progress-icon ${CompletionStatus.Current}`);
    progressTextEl.text(`${currentQuestionNum + 1}/${exerciseList.length}`);
})();