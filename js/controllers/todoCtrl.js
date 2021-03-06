/*global angular */

/**
 * The main controller for the app. The controller:
 * - retrieves and persists the model via the todoStorage service
 * - exposes the model to the template and provides event handlers
 */
angular.module('calendar_tasks')
	.controller('TodoCtrl', ['$scope', '$interval', '$filter', 'todoStorage', '$http', '$sce', '$compile', function TodoCtrl($scope, $interval, $filter, store, $http, $sce, $compile ) {
		'use strict';

        var store;
        var vm = this;
		vm.todos = null;// = $scope.todos = store.todos;
        vm.currentDate = null;
        vm.editedTodo = null;
        vm.empty = false;

        vm.newTask = '';

        vm.txMap = {};

        function _populateResult(result) {
            if (result.daily) {
                vm.todos = result.daily;
                vm.empty = false;
            }
            else if (result.default && result.default.length) {
                vm.todos = [];
                vm.empty = true;
                vm.defaults = result.default;
            }
            else {
                vm.todos = result.default;
                vm.empty = false;
            }   

            if (vm.todos && vm.todos[0] && vm.todos[0].txhash && vm.txMap[vm.todos[0].txhash]) {
                $interval.cancel(vm.txMap[vm.todos[0].txhash]);
                delete vm.txMap[vm.todos[0].txhash];
            }

        };

        vm.init = function(type = 'active') {
            if ( typeof(webExtensionWallet) === "undefined" ) {
                vm.installWallet = true;
            }
            else {
                vm.installWallet = false;
                var dt = $filter('date')(new Date(), "yyyy-MM-dd");
                store.get(dt).then(_populateResult);
            }
        }

        
        vm.addTask = function() {
            var text = vm.newTask.trim();
			if (!text) {
				return;
			}

            var completed = false;
            var date = $filter('date')( vm.currentDate || new Date(), "yyyy-MM-dd");

            store.add(text, date, completed)
				.then(function success(block_response) {
                    vm.empty = false;
                    console.log('[ctrl] on success block_task', block_response);
                    vm.newTask = '';
                    var tmpTask = {'text': text, 'date':date, 'completed':completed, 'id':false, 'hash':block_response['txhash'] };
                    vm.todos.push( tmpTask );
                    vm.txMap[ block_response['txhash'] ] = false; //pending
                    $interval( _checkTxHash, 10000, 3, false, tmpTask );
				})
				.finally(function () {
					$scope.saving = false;
				});

        };

        function _checkTxHash(tmpTask) {
           // console.log('[_checkHash]', tmpTask, vm.todos.indexOf(tmpTask));
            store.checkHash( tmpTask.date, tmpTask.hash ).then(function(ret){
                console.log('[_checkHashGET]', ret);
                if (ret && ret.result && ret.result !== "null") {
                    vm.todos[vm.todos.indexOf(tmpTask)].id = ret.result.replace(/"/g, "");
                   // tmpTask.id = ret.result;
                    console.log(vm.todos)
                }
            })
        }



		vm.removeTask = function (task) {
			store.delete(task).then( function() {
                vm.todos.splice(vm.todos.indexOf(task), 1);
            });
		};

        vm.initTasks = function() {
            var date = $filter('date')(vm.currentDate, "yyyy-MM-dd");

            store.initDate(date).then(function(block_response){
                console.log('[init date]', block_response);

                function _checkList(params) {
                    console.log('[_checkList] ', params.hash);
                    store.get(params.date).then(_populateResult);//.finally( function(){} );
                };
                vm.txMap[ block_response.txhash ] = $interval( _checkList, 3000, 10, false, {'date':date, 'hash':block_response.txhash} );
            });
        };

        vm.onDateChange = function() {
            vm.todos = [];
            var date = $filter('date')(vm.currentDate, "yyyy-MM-dd");
            store.get(date).then(_populateResult);
		};

        vm.toggleCompleted = function(task){
            store.complete(task).then(function() {
                console.log('[ctrl] completed', task.completed);
            });
        };

	    vm.editTask = function (task) {
			vm.editedTodo = task;
			// Clone the original todo to restore it on demand.
			vm.originalTodo = angular.extend({}, task);
		};

		vm.revertEdits = function (task) {
			vm.todos[vm.todos.indexOf(task)] = vm.originalTodo;
			vm.editedTodo = null;
			vm.originalTodo = null;
			vm.reverted = true;
		};

		vm.saveEdits = function (todo, event) {
			// Blur events are automatically triggered after the form submit event.
			// This does some unfortunate logic handling to prevent saving twice.
			if (event === 'blur' && $scope.saveEvent === 'submit') {
				$scope.saveEvent = null;
				return;
			}

			$scope.saveEvent = event;

			if (vm.reverted) {
				// Todo edits were reverted-- don't save.
			    vm.reverted = null;
				return;
			}

			todo.text = todo.text.trim();

			if (todo.text === vm.originalTodo.text) {
				vm.editedTodo = null;
				return;
			}

            store.update(todo).then(function(block_resp){
                 console.log('[update]', block_resp);
                vm.editedTodo = null;
            });
			
		};

	}]);
