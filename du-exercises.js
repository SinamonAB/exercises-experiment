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

    // Inject CSS and additional Javascript
    $("head").first().append(`<link rel="stylesheet" type="text/css" href="http://localhost:63342/key-vocab-playground/grammar-questions/du-exercises.css">`);
    await $.getScript("https://code.jquery.com/ui/1.13.3/jquery-ui.js");

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
    const ExerciseState = {
        Initial: "initial",
        Answered: "answered",
        ClickCheckWithoutSelection: "click-check-without-selection",
        Checking: "checking"
    }

    const updateExerciseState = (exerciseJson, newState) => {
        // reset state
        exerciseJson.el.removeClass(`state-${exerciseJson.state}`);
        exerciseJson.el.find(".btn").off("click");
        if (typeof exerciseJson.el.find(".solution").sortable() !== "undefined") {
            exerciseJson.el.find(".solution").sortable("destroy");
        }
        exerciseJson.el.find(".check-btn").text("Check");

        const initial = () => {
            // reading
            exerciseJson.el.find(".reading-choice-btn").click((e) => {
                exerciseJson.el.find(".reading-choice-btn").removeClass("selected");
                $(e.target).addClass("selected");
                updateExerciseState(exerciseJson, ExerciseState.Answered);
            });

            // grammar
            exerciseJson.el.find(".word-bank-btn").click((e) => {
                const el = $(e.target);
                if (el.hasClass("disabled")) {
                    return;
                }
                const word = el.data("word");
                const wordSlot = exerciseJson.el.find(".word-slot-btn.empty:first");
                wordSlot.find(".word-span").text(word);
                wordSlot.data("word", word);
                wordSlot.removeClass("empty");
                $(e.target).addClass("disabled");
                if (exerciseJson.el.find(".word-slot-btn.empty").length === 0) {
                    updateExerciseState(exerciseJson, ExerciseState.Answered);
                }
            });
            exerciseJson.el.find(".word-slot-btn").click((e) => {
                const el = $(e.target);
                if (el.hasClass("empty")) {
                    return;
                }
                const word = el.data("word");
                const wordBank = exerciseJson.el.find(`.word-bank-btn[data-word="${word}"]`).first();
                wordBank.removeClass("disabled");
                el.find(".word-span").text("?");
                el.addClass("empty");
                // move clicked word slot to end of list
                el.parent().appendTo(exerciseJson.el.find(".solution"));
                if (exerciseJson.el.find(".word-slot-btn.empty").length > 0) {
                    updateExerciseState(exerciseJson, ExerciseState.Initial);
                }
            });
            exerciseJson.el.find(".solution").sortable({
                items: "li:has(.word-slot-btn:not(.empty))",
                cancel: "",
                tolerance: "pointer"
            });

            // general
            exerciseJson.el.find(".skip-btn").click(() => {
                completeExercise(exerciseJson, CompletionStatus.Skipped);
            });
        };
        switch (newState) {
            case ExerciseState.Initial:
            case ExerciseState.ClickCheckWithoutSelection:
                initial();
                exerciseJson.el.find(".check-btn").click(() => {
                    updateExerciseState(exerciseJson, ExerciseState.ClickCheckWithoutSelection);
                });
                break;
            case ExerciseState.Answered:
                initial();
                exerciseJson.el.find(".check-btn").click(() => {
                    updateExerciseState(exerciseJson, ExerciseState.Checking);
                });
                break;
            case ExerciseState.Checking:
                let correct = undefined;
                switch (exerciseJson.question_type) {
                    case "reading":
                        const selectedOptionNum = exerciseJson.el.find(".reading-choice-btn.selected").data("option-num");
                        correct = selectedOptionNum === exerciseJson.solution;
                        exerciseJson.el.find(`.reading-choice-btn[data-option-num=${exerciseJson.solution}]`).addClass("correct");
                        if (!correct) {
                            exerciseJson.el.find(".reading-choice-btn.selected").addClass("wrong");
                        }
                        break;
                    case "grammar":
                        const givenAnswer = exerciseJson.el.find(".word-slot-btn:not(.empty)").map((_, el) => $(el).data("word")).get().join("");
                        correct = exerciseJson.solutions.includes(givenAnswer);
                        exerciseJson.el.find(".word-slot-btn").addClass(correct ? "correct" : "wrong");
                        break;
                    default:
                        break;
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
    const makeExerciseEl = (exerciseJson) => {
        let instruction = "";
        let task = "";
        switch (exerciseJson.question_type) {
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
                        <span class="question">${exerciseJson.question}</span>
                        <ol class="answer-options">
                            ${exerciseJson.answer_options.map((option, optionNum) => {
                                return `<li><button type="button" class="btn exercise-btn reading-choice-btn" data-option-num="${optionNum}">${option}</button></li>`;
                                }).join("")}
                        </ol>
                    </div>
                    <div class="exercise-instruction select-option-first-text">
                        <span>Click on the answer first.</span>
                    </div>`;
                break;
            case "grammar":
                instruction = `
                    <div class="exercise-instruction">
                        <div>
                            <span class="exercise-type">Grammar</span>
                        </div>
                        <span>Translate the English sentence using a correct grammar pattern.</span>
                    </div>`;
                task = `
                    <div class="exercise-task">
                        <span class="english">${exerciseJson.english}</span>
                        <ol class="solution word-list">
                            ${exerciseJson.word_bank.map((word) => {
                                return `<li><button type="button" class="btn word-btn exercise-btn word-slot-btn empty" data-word=""><span class="word-span">?</span></button></li>`;
                                }).join("")}
                        </ol>
                        <ol class="word-bank word-list">
                            ${exerciseJson.word_bank.map((word) => {
                                return `<li><button type="button" class="btn word-btn exercise-btn word-bank-btn" data-word="${word}"><span class="word-span">${word}</span></button></li>`;
                                }).join("")}
                        </ol>
                    </div>
                    <div class="exercise-instruction select-option-first-text">
                        <span>Click on all words in the word list to form the translation of the English sentence.</span>
                    </div>`;
                break;
            default:
                instruction = `Unknown question type: ${exerciseJson.question_type}`;
                break;
        }
        exerciseJson.el = $(`
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
        exercisesEl.append(exerciseJson.el);
        exerciseJson.el.hide();
        updateExerciseState(exerciseJson, ExerciseState.Initial);
    };
    exerciseList.forEach((exerciseJson, exerciseNum) => {
        exerciseJson.num = exerciseNum;
        makeExerciseEl(exerciseJson);
    });

    // Show first exercise
    exerciseList[currentQuestionNum].el.show();
    const nextProgressIconEl = progressIconsEl.find(`.progress-icon[data-exercise-num=${currentQuestionNum}]`);
    nextProgressIconEl.attr("class", `progress-icon ${CompletionStatus.Current}`);
    progressTextEl.text(`${currentQuestionNum + 1}/${exerciseList.length}`);
})();